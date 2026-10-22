# ApnaKart backend — code map

This file explains what every file does and how the main flows work, so a developer (or an AI) can find the right place quickly. Rules for changing the code are in `AGENTS.md`; setup and deploy steps are in `README.md`.

Stack: Node.js + Express + TypeScript, Prisma on PostgreSQL (pgvector for embeddings, pg_trgm for spelling search, generated `tsvector` columns for full-text search), Redis (cache, rate limits, OTP, sessions, locks), Zod (input checks), Winston + Morgan (logs). Outside services: Razorpay (payments), MSG91 (OTP SMS), Cloudinary (images), Gemini (embeddings and the AI model).

Money is always integer paise (`₹499` = `49900`).

---

## 1. How a request goes through the code

1. `src/server.ts` connects Prisma, starts Express (`app`) and the background jobs.
2. `src/app.ts` runs, in this order: `trust proxy` (`TRUST_PROXY_HOPS`), `helmet`, `compression`, `cors` (only `FRONTEND_ORIGINS`), a request id (`X-Request-Id` header), the request logger, then:
   - `POST /api/order/webhook` with the raw body (Razorpay signs the raw bytes), before the JSON parser;
   - `express.json` (1 MB max);
   - `/health` routes;
   - `/api` → the general rate limit (`API_RATE_MAX` per minute per visitor) → `routes/index.ts`;
   - a 404 handler and `middleware/error.ts`.
3. A route file adds what it needs: `authCheck` / `optionalAuth`, `roleCheck`, a named `rateLimiter`, `validate(schema)`, `multer` uploads.
4. The controller (wrapped in `asyncHandler`) reads `req`, calls one service function and sends `{ success: true, data }` or `{ success: true, items, nextCursor }`.
5. Services hold all logic and database access. Expected problems are thrown as `AppError(message, status)`.
6. `middleware/error.ts` turns every error into `{ success: false, message }` with the right status (Zod → 400, Prisma unique → 409, pool or transaction wait timeout → 503, …). Unknown errors are logged with the request id and answered 500.

---

## 2. Files

### Entry files

| File | What it does |
| --- | --- |
| `src/server.ts` | Starts the app. `runEvery(ms, name, job)` runs a background job on a timer, first run after 10 s, only one server copy at a time (Redis lock `job:<name>`, max 10 min, freed when the run ends). Jobs: order expiry and offer expiry and embeddings every minute, session cleanup and webhook cleanup daily. `shutdown` stops jobs, waits for open requests, closes Prisma and Redis (forced exit after 10 s). |
| `src/app.ts` | Builds the Express app and middleware order described above. `origin` is the CORS check (all origins in development; requests without an Origin header are allowed). |

### `src/config/`

| File | What it does |
| --- | --- |
| `env.ts` | Reads and checks every environment variable with Zod; the app exits at start if one is wrong. MSG91, Cloudinary and Razorpay keys are required only in production. `INTERNAL_API_KEY` must be empty or 32+ characters. |
| `db.ts` | The Prisma client (transaction wait 10 s, timeout 20 s). `lockUser` (row lock + blocked/deleted check) and `lockProduct` for read-then-write work inside transactions. |
| `redis.ts` | The ioredis client (no offline queue, 1 s command timeout). `countInWindow` (counter that expires, used by every limit), `getOrSetCache` (5 min cache; one load per key per process even when many requests ask at once; falls back to the database when Redis is down), `clearCache` (bumps `cache:version`, so every cached entry is dropped at once). |
| `winston.ts` | The logger: readable lines in development, JSON in production; errors keep message and stack. |
| `morgan.ts` | `requestLogger`: one log line per request with `requestId`, `userId`, `method`, `path`, `status`, `ms` (-1 if the client aborted), `ip`. 5xx → `error`, slower than 1 s → `warn`. `/health` is not logged. |

### `src/routes/` (URL → middleware → controller)

| File | URLs (all under `/api` except health) |
| --- | --- |
| `index.ts` | Mounts every router below on its path. |
| `health.routes.ts` | `GET /health` (process is up), `GET /health/ready` (database and Redis answer; 60/min). |
| `home.routes.ts` | `GET /home`. |
| `catalog.routes.ts` | `GET /catalog`. Text searches (`?q=`) also pass the search limit (30/min per visitor); browsing does not (`limitSearchOnly`). |
| `product.routes.ts` | `GET /products/:slug`, `/:slug/related`, `/:slug/reviews`; `POST /:slug/reviews` (login). |
| `auth.routes.ts` | `POST /auth/send-otp` (20/hour per IP), `verify-otp` (10/min), `refresh` (120/min), `logout`. |
| `user.routes.ts` | `GET/PATCH/DELETE /user/me` (login). |
| `address.routes.ts` | `GET/POST /address`, `PATCH/DELETE /address/:id` (login). |
| `cart.routes.ts` | `GET/POST /cart`, `PATCH/DELETE /cart/:id` (login). |
| `order.routes.ts` | `POST /order/checkout` (10/min), `GET /order`, `GET /order/:id`, `POST /order/:id/payment`, `POST /order/:id/verify-payment` (10/min), `PATCH /order/:id/cancel` (login). The webhook route is in `app.ts`. |
| `admin.routes.ts` | Everything under `/admin`, for ADMIN and SUPER_ADMIN only: uploads (30/min), products, bulk products, sale, categories, brands, banners, stats, orders, users, reviews. Changing a user's role needs SUPER_ADMIN. |
| `assistant.routes.ts` | `POST /assistant/chat` (guests and users, 15/min). |

### `src/controller/`

Thin files: each handler reads the request, calls one service function and sends the response. One handler per endpoint, named after what it does (`checkout`, `verifyPayment`, `listAdminOrders`, …). Special cases:

- `order.controller.ts` → `razorpayWebhook` checks the `x-razorpay-signature` on the raw body, handles only `payment.captured`, uses `x-razorpay-event-id` (or the payment id) as the event id, and answers 500 on an unexpected error so Razorpay retries.
- `admin.controller.ts` uploads images to Cloudinary before calling the service (`checkSlugFree` / `checkProductExists` run first so a bad request does not upload anything).
- `assistant.controller.ts` passes the user (or `null` for guests) and a visitor id (user id, or the visitor's IP) to the assistant.
- `auth.controller.ts` and `user.controller.ts` set and clear the refresh cookie.

### `src/middleware/`

| File | What it does |
| --- | --- |
| `authCheck.ts` | `authCheck`: needs `Authorization: Bearer <access token>` for a live session; the user's role comes from `tokenService.getSessionRole` (cached 60 s), so a blocked or logged-out user is out within a minute. `optionalAuth`: same when a token is sent, guests pass. |
| `roleCheck.ts` | `roleCheck(...roles)`: 403 unless `req.user.role` is one of them. |
| `rateLimiter.ts` | `rateLimiter({ name, seconds, maxRequests, allowIfRedisDown })`: counts per visitor (`visitorOf`: user id of a valid token, else IP; IPv6 cut to /64 by `visitorIp`). Over the limit → 429. Redis down → let through (`allowIfRedisDown`) or 503. `fromFrontendServer`: requests with the right `x-internal-key` (the frontend's server-side page loads) are never limited. |
| `validate.ts` | Runs a Zod schema on `{ body, query, params }` and replaces them with the cleaned values. |
| `error.ts` | `errorHandler`: maps errors to status codes and messages (see section 1). |

### `src/validation/` (Zod request schemas)

| File | Checks |
| --- | --- |
| `common.ts` | Shared pieces: `uuid`, `idParams`, `idParamSchema`, `slug`, `phone`, `orderStatus`, `queryBoolean`, `GENDERS`, `AGE_GROUPS`, `commaList` ("red,blue" → list), `pageParams` (cursor + limit 1–50). |
| `auth.validation.ts` | Indian mobile number (spaces, dashes, +91 allowed) and a 6-digit OTP. |
| `user.validation.ts` | Name and email changes. |
| `address.validation.ts` | Address fields (10-digit phone, 6-digit pincode). |
| `cart.validation.ts` | Product id, quantity 1–10, optional size and colour. |
| `catalog.validation.ts` | Every list filter: `q` (2–80 chars), category, subcategory, section, brand, colour (Title Case), size, gender, age group, price range in paise, offers, min rating, sort, cursor, limit. |
| `product.validation.ts` | Product slug, review list paging, review (1–5 stars, optional comment). |
| `order.validation.ts` | Checkout (address, COD/ONLINE, idempotency key, optional buy-now product), order list filters, payment verify fields. |
| `admin.validation.ts` | Product create/edit/bulk (form fields and JSON; "Key: value" spec lines; "" clears a value), sale, categories, brands, banners (safe links only), order status, user block and role. |
| `assistant.validation.ts` | Chat: 1–30 messages; the last one is the question: 2–300 characters, at most 2 lines, real words, no HTML/script. Messages are cleaned and only the last 20 are kept. |

### `src/service/` (all business logic)

| File | What it does |
| --- | --- |
| `auth.service.ts` | `requestOtp` (refuses blocked accounts), `verifyOtpAndLogin` (checks the OTP, creates the user on first login, `SUPER_ADMIN_PHONE` becomes super admin, starts a session). |
| `otp.service.ts` | `send`: 6-digit OTP, only its HMAC is kept in Redis for 2 min; 1 per minute and 5 per hour per phone; `DAILY_SMS_CAP` for the whole store; when the SMS fails the 1-minute wait is removed so the user can retry at once. `verify`: works once, 3 wrong tries delete it (a Lua script does check-and-count in one step). |
| `token.service.ts` | Sessions. `createSession`, `getSessionRole` (cached 60 s in `session:<id>`), `refreshSession` (rotates the refresh token id `jti`; the previous one still works for 60 s for a second tab; any older one means theft, so the session is deleted), `logout`, `logoutAllDevices`, `deleteExpiredSessions`. |
| `user.service.ts` | Profile read and edit; `deleteAccount` clears personal data, addresses and cart, keeps orders, logs out everywhere (the super admin cannot be deleted). |
| `address.service.ts` | Up to 5 addresses, always exactly one default; uses `lockUser` so two requests cannot break that. |
| `home.service.ts` | `getHome`: banners, top categories with children, and 10 products each for trending, featured, newest and offers (cached as `home`). |
| `product.service.ts` | `getBySlug` (product page with specs, category, brand and star bars; cached `product:<slug>`), `getRelated` (8 newest of the same category; cached), `expireOffers` (job: zero the discount of ended offers and fix `sellPaise`). |
| `catalog.service.ts` | The product list for browse and search. `pageFilters` turns the page's filters into SQL. `sortedPage` reads one page in the chosen sort with a keyset cursor (`sortBy` builds `ORDER BY` and the "after the cursor" condition). `searchProducts` runs the shared search with the page filters inside it: no sort → best 500 in relevance order; a sort → every match sorted in SQL. `pageOf` loads the cards of one page (hidden products dropped). `list` caches each exact query for 5 min. |
| `cart.service.ts` | `getCart` (live prices; unavailable or over-stock lines stay visible but are not in the total), `addItem` (size/colour must exist — `chooseOptions`; same line adds up; max 10 per product and 50 lines), `updateItem`, `removeItem`, `clear`. All writes lock the user row. |
| `order.service.ts` | `checkout`, `retryPayment`, `verifyPayment`, `handlePaymentCaptured`, `cancel`, `updateStatus`, `markRefunded`, `releaseExpiredOrders`, `deleteOldWebhookEvents`, `listForUser`, `getForUser`. Helpers: `getOrderLines` (lines from cart or buy-now with today's prices), `checkOpenOrderLimit`, `lockOrder`, `cancelAndReturnStock`, `cancelUnpaidOrder` (an unpaid online order goes back to the cart), `checkCanCancel`. Details in section 3. |
| `review.service.ts` | `list`, `save` (only after one of the user's orders with that product is DELIVERED; one review per user per product, editing changes the rating sum), `removeByAdmin`. Rating sum/count/average are kept on the product. |
| `admin.service.ts` | Admin work: products (create, bulk create, edit, hide, sale), categories (two levels), brands, banners, stats (today in India time), order and user lists, block, role. Any change shoppers see calls `clearCache()`. Editing a product's text fields (`EMBEDDING_FIELDS`) or renaming a brand/category sets the affected `embedding` to NULL so the job makes new ones. `applySale` is one SQL `UPDATE` using the same rounding as `finalPrice`. |
| `assistant.search.ts` | The search engine for the store search box and the assistant. See section 3.3. |
| `assistant.service.ts` | The chat flow. See section 3.4. |
| `assistant.tools.ts` | Tools the AI model may call. Users: `search_products`, `get_product` (with specs and latest reviews), `get_profile`, `get_cart`, `add_to_cart`, `remove_from_cart`, `clear_cart`*, `list_orders`, `cancel_order`*. Admins also: `admin_find_products`, `admin_orders`, `admin_find_users`, `admin_low_stock`, `admin_stats`, `admin_update_product`*. (*asks to confirm first, in the chat's language.) Every tool calls the normal services, so all rules still apply. `toolsFor` and `findTool` (checks the tool is allowed and its input is valid). |
| `embedding.service.ts` | `fillMissing` (job): finds active products with `embedding IS NULL` (partial index), 100 per Gemini call, 2,000 per run at most. `embedBatch` builds each product's text (name, brand, categories, gender, age group, colours, sizes, specs, first 500 characters of the description; at most 2,000 characters, so one long product cannot make Gemini reject the batch) and saves the vector only if the product did not change meanwhile. |

### `src/integration/` (one file per outside service)

| File | What it does |
| --- | --- |
| `razorpay.ts` | `createRazorpayOrder`, `fetchVerifiedPayment` (checks the checkout signature, then asks Razorpay the payment is captured), `verifyWebhookSignature` (HMAC in constant time). The client is created on first use. |
| `msg91.ts` | `sendOtpSms`; in development it only logs `DEV OTP -> <phone>: <otp>`. |
| `storage.ts` | Multer (memory, 2 MB, jpg/png/webp) and Cloudinary upload; `uploadImage` checks the file's first bytes really are an image. |
| `gemini.ts` | `embedTexts` (768-number vectors) and `chatOnce` (one model call with tools), 15 s timeout, Gemini 429 → friendly 429. `geminiReady` is false without `GEMINI_API_KEY`. |

### `src/utils/` (small pure helpers)

| File | What it does |
| --- | --- |
| `price.ts` | `finalPrice` (the only discount formula; rounded to whole rupees; 0 after the offer ends), `stockStatus` (IN_STOCK / LOW_STOCK ≤ 5 / OUT_OF_STOCK), `productCard` (the one card shape every list returns), `CARD_SELECT`, `ACTIVE_CATEGORY` (Prisma "visible category" filter), `LOW_STOCK_AT`. |
| `paginate.ts` | `pageQuery` (Prisma `take limit+1` + cursor) and `paginate` (cuts the extra row, returns `nextCursor`). |
| `token.ts` | Sign and verify the access token (15 min) and refresh token (15 days). |
| `cookies.ts` | Set, clear and read the `refreshToken` cookie (HttpOnly, `path=/api/auth`, `SameSite=None; Secure` in production). |
| `appError.ts` | `AppError(message, statusCode)`. |
| `asyncHandler.ts` | Sends errors from async handlers to the error middleware. |
| `text.ts` | `titleCase` (colour names). |

### `prisma/`

| File | What it does |
| --- | --- |
| `schema.prisma` | Tables (section 4). |
| `migrations/` | SQL migrations in order. Raw-SQL parts Prisma cannot model: the HNSW embedding index, the generated `searchText` / `descriptionText` columns with GIN indexes, and the partial index `Product_missing_embedding_idx`. |
| `seed.ts` | `npm run seed` (development only): wipes the database and adds categories, brands, `SEED_PRODUCTS` products (default 5,000), 500 users with addresses, 3,000 orders and reviews. The random numbers are fixed (`random`), so every run gives the same data. |
| `catalog.ts` | The demo product list: real models (phones, laptops, audio, grocery, beauty…) with their prices, plus clothes and shoes built from brand lines (`fashion`). `buildCatalog(total, random)` returns exactly `total` products: a line that runs out of new names is topped up by the other lines. |

### `test/` (development only, not deployed)

| File | What it does |
| --- | --- |
| `helpers.ts` | `startServer` starts the API from `src/` on port 8099 in development mode and keeps the OTPs it prints (`otpFor`). `call` calls one API like a browser (IP in `x-forwarded-for`, token, cookie, raw body) and measures the time. |
| `flow.ts` | `npm run test:flow`: one new shopper and the admin use every feature once — health, home cache, browse with cursor, Hinglish and misspelled search, 404, search rate limit, OTP (hash in Redis, resend gap, wrong OTP), profile with and without token, address, cart, COD checkout (stock taken), same idempotency key, cancel (stock back), my orders, Razorpay online order, fake payment proof, webhook (bad signature, captured, duplicate), assistant (guest search, cart rule, unsafe text), admin role check, bulk add (in search at once), embedding job, hide, logout, refresh rotation and reuse. `step` prints one line per step: API, answer code, time and what happened. Payment, admin and embedding steps are skipped when their keys are empty. |
| `load.ts` | `npm run test:load -- <shoppers> <seconds>` (default 1,000 for 120): that many logged-in shoppers (phones `6000000000` and up, a session each, no OTP) shop at the same time, reading each page 5–15 s: home, category, search, product and reviews, add to cart, then a COD order (1 in 5, cancelled at once so stock stays the same) or remove the line, the assistant (1 in 3) and my orders. `measure` keeps each call's time and answer; `printReport` prints a table per API, calls a second and errors (5xx or no answer); PASS when there are none and 95% of calls took under 1 s. |

---

## 3. Main flows

### 3.1 Login and session

1. `POST /auth/send-otp` → `authService.requestOtp` → `otpService.send` → `sendOtpSms`.
2. `POST /auth/verify-otp` → `otpService.verify` → user upsert → `tokenService.createSession`. Response: `{ user, accessToken }` + `refreshToken` cookie.
3. Every protected request: `authCheck` verifies the access token, then `getSessionRole` checks the session row (cached 60 s).
4. `POST /auth/refresh` (cookie) → `refreshSession`: new access token + new refresh cookie. Reusing an old refresh token after 60 s deletes the session.
5. Blocking a user, changing a role or deleting an account → `logoutAllDevices`.

### 3.2 Browse and search (`GET /catalog`)

1. `catalogService.list` caches by the exact query (5 min, cleared on admin changes).
2. Browse (no `q`): `sortedPage([VISIBLE_PRODUCT, ...pageFilters])` → SQL with `ORDER BY <sort>, id` and `(column, id) > / < (cursor row)` → `pageOf` loads the cards.
3. Search (`q`): `readQuestion(q)` → `searchIds(question, 500, { where: pageFilters, spelling: true })`:
   - instant search (`searchDb`) → if nothing, embedding search (`searchByMeaning`, needs Gemini) → if nothing, spelling search (`searchBySpelling`);
   - returns `ids` (rank order) and `match` (the SQL that matched).
4. No sort → page cut from the 500 ids. A sort → `sortedPage([...match, ...pageFilters])`, so every match is sorted, not only the first 500.

### 3.3 The search engine (`assistant.search.ts`)

- `getVocabulary` (cached): active brands, categories, all colours, and spec names whose values are mostly numbers — read from the database, so new data needs no code change.
- `readQuestion(text)` turns a question into a `Question`: Devanagari → Latin (`DEVANAGARI`), rating ("4 star"), budget (`readBudget`: "under 2000", "2k-5k", "500 se upar", a bare "1999"), service phrases removed ("free delivery"), size ("size 9", "M"), brands, who it is for (`WHO`: men/women/kids…), sort words (`SORTS`: sasta, best, new…), offer/trending/featured words, colours (a base colour also matches its shades), categories (and their subcategories), occasions (`OCCASIONS`), spec names, left-over `words` (filler removed, Hindi words mapped by `ALIASES`) and model numbers ("15" in "iphone 15").
- `filterSql(question)`: the hard filters as SQL (visible product, brand, category, colour, who, price, rating, offer, size, spec). `whereFor(question)` adds the words: unit words like `128gb` must match; otherwise all words (1–2 words) or half of them must match the name/specs (`searchText`) or description (`descriptionText`).
- `searchDb`: instant search. Order: asked category first, more words in the name, then (when there is no sort word) a mix across categories, then words in the text, occasion, spec value, sort.
- `searchByMeaning`: pgvector cosine distance under `MAX_DISTANCE` (0.45), looks at most 5,000 nearest products; the question's vector is cached 7 days (`ai:vector:`).
- `searchBySpelling`: pg_trgm similarity on product, brand and category names; 2 s limit; errors give no results.
- `searchIds`: the cheapest-first chain above, each step cached (`ai:db:`, `ai:meaning:`, `ai:spelling:`).
- `findProducts` (assistant): 50 results max, 5 per answer (`PAGE_SIZE`), cards read fresh (`liveCards`), and `askWho` when men/women or kids/adults are mixed.
- `findAlternative`: when nothing matched, what exists instead (other colours, sizes, brands, cheapest price, highest price, best rating).

### 3.4 AI assistant (`assistantService.chat`)

1. Blocked visitor → 403. `confirm` in the body → `runPendingAction` (runs or drops the saved action).
2. Unsafe text (`UNSAFE`) → warning; the third in a day blocks for 24 h. Small talk → help text. Questions about the bot → "only ApnaKart". Guests: 30 questions an hour.
3. `isActionText` decides if it is a cart/order request (`ACTION_WORDS`; `ORDER_WORDS` only when no product is named).
4. Not an action → `searchFromChat` (the last product question plus later follow-ups like "red", "under 2000", "next") → `productAnswer` (products, or what is available instead).
5. Guests stop here (login reply for actions, "nothing matches" otherwise).
6. `quickAction` without the AI model: remove an item / empty the cart (confirm), cancel an order (confirm), show cart, show orders or one order.
7. Not about the store → `notFound` (if it had product-like words) or `onlyStore`. No Gemini key → `notFound`.
8. Quota: user 20 / admin 100 per 5 hours (`ai:quota:`), plus `AI_DAILY_LIMIT` for the store (`ai:daily`).
9. `askAi`: up to 4 rounds of model ↔ tools with the last 6 messages; risky tools stop and ask to confirm (`askToConfirm` saves `ai:pending:<user>` for 5 min).
10. Replies are Hinglish when the user writes Hindi words (`languageOf`), else English (`REPLIES` has both).

### 3.5 Cart

`addItem` / `updateItem` / `removeItem` / `clear` lock the user row, check the product is visible, the size/colour, and that the total of all lines of that product is within stock and 10. The cart response always has live prices.

### 3.6 Checkout (`orderService.checkout`)

1. Same idempotency key as an earlier order → return that order (only if address and payment type are the same).
2. First check without locks: lines from the cart (or the buy-now product) with today's prices, open-order limit (2 unpaid online, 10 open COD), address belongs to the user.
3. Online → create the Razorpay order (min ₹1) before the transaction.
4. Transaction: lock the user, check the key again, lock the products (`FOR UPDATE`, id order), read the lines again; a changed total → 409 "Prices changed". Take stock with `UPDATE … WHERE stock >= qty` (409 if it fails), create the order with a copy of the address, delete the ordered cart lines.
5. COD → `CONFIRMED` at once. Online → `PENDING` with `paymentExpiresAt` = now + 30 min; the response has the Razorpay key and order id.
6. If a product's stock status changed (in stock / low / out) → `clearCache()`.

### 3.7 Payment and unpaid orders

- Browser: Razorpay window → `POST /order/:id/verify-payment` → `fetchVerifiedPayment` → `handlePaymentCaptured("verify:<paymentId>", payment)`.
- Razorpay: webhook `payment.captured` → `handlePaymentCaptured(eventId, payment)`.
- `handlePaymentCaptured` runs once per event id (`WebhookEvent` row). On time and right amount → `CONFIRMED` + `COMPLETED`. Late, wrong amount or a second payment → the order is cancelled if still pending (stock back) and marked `needsReview` so the admin refunds it in Razorpay and presses "refunded" (`markRefunded`).
- `releaseExpiredOrders` (every minute): online orders still unpaid after 30 min are cancelled by SYSTEM, stock returned, items put back in the cart (up to 2,000 per run).
- `deleteOldWebhookEvents` (daily): removes event ids older than 30 days.

### 3.8 Order status, cancel, refund

- `cancel` (user: own order; admin: any) → `checkCanCancel` (only unpaid and not shipped) → `cancelUnpaidOrder` (stock back; online unpaid → items back to cart).
- `updateStatus` (admin): CONFIRMED → SHIPPED → DELIVERED, or CANCELLED (unpaid only). COD becomes paid on delivery.

### 3.9 Admin changes and the cache

Every admin write that shoppers can see calls `clearCache()` (one version number for every cached entry). Orders call it only when a stock status changes; reviews call it because ratings show on cards; the offer job calls it when an offer ended.

### 3.10 Embeddings

`embedding IS NULL` means "needs a vector". New products start NULL; text edits and brand/category renames set it back to NULL; the every-minute job fills them. Without `GEMINI_API_KEY` the job does nothing and search uses instant and spelling search only.

---

## 4. Database tables (`prisma/schema.prisma`)

| Table | Holds |
| --- | --- |
| `User` | Phone (unique), name, email, role (USER / ADMIN / SUPER_ADMIN), blocked, deleted. |
| `Session` | One login per device: current refresh id `jti`, `previousJti` + `rotatedAt` (60 s grace), expiry. |
| `Address` | Up to 5 per user, one default. |
| `Category` | Two levels (`parentId`), active flag, image. |
| `Brand` | Name, slug, logo, active flag. |
| `Product` | Price, discount, offer end, `sellPaise` (price after discount, kept for filters and sorts), stock, colours[], sizes[], gender, age group, images[], specs (JSON), category, brand, flags (active, trending, featured), rating sum/count/average, `embedding` halfvec(768), generated `searchText` and `descriptionText`. |
| `Cart`, `CartItem` | One cart per user; a line is product + size + colour (unique together). |
| `Order` | Idempotency key (unique per user), address copy (`ship*`), total, status, payment status/method, `paymentExpiresAt`, Razorpay ids, `needsReview`, `cancelledBy`. |
| `OrderItem` | Product name, image and price at order time, quantity, size, colour. |
| `WebhookEvent` | Event ids already handled (duplicates are ignored). |
| `Review` | One per user per product: rating, comment. |
| `Banner` | Home slides: image, link, position, active. |

---

## 5. Redis keys

| Key | Use |
| --- | --- |
| `cache:version` | Current cache version; cached entries are `cache:<version>:<name>`. |
| `cache:<v>:home`, `product:<slug>`, `related:<slug>`, `catalog:<hash>` | Page data (5 min). |
| `cache:<v>:ai:vocabulary`, `ai:db:…`, `ai:meaning:…`, `ai:spelling:…`, `ai:alternative:…` | Search vocabulary and id lists (5 min). |
| `ai:vector:<hash>` | A question's embedding (7 days). |
| `rate:<limit name>:<visitor>` | Rate-limit counters. |
| `otp:<phone>`, `otp:gap:`, `otp:hour:`, `otp:day:<date>` | OTP hash and OTP limits. |
| `session:<sessionId>` | Session role cache (60 s). |
| `ai:guest:`, `ai:quota:`, `ai:daily`, `ai:strike:`, `ai:block:`, `ai:pending:` | Assistant limits, warnings, blocks and the action waiting for confirmation. |
| `job:<name>` | Background job lock. |

---

## 6. Background jobs (`server.ts`)

| Job | Every | Does |
| --- | --- | --- |
| Order expiry | 1 min | `orderService.releaseExpiredOrders` |
| Offer expiry | 1 min | `productService.expireOffers` |
| Embedding | 1 min | `embeddingService.fillMissing` |
| Session cleanup | 1 day | `tokenService.deleteExpiredSessions` |
| Webhook cleanup | 1 day | `orderService.deleteOldWebhookEvents` |

---

## 7. Environment variables (`.env.example`)

`NODE_ENV`, `PORT`, `LOG_LEVEL`, `TRUST_PROXY_HOPS`, `API_RATE_MAX`, `INTERNAL_API_KEY` (shared with the frontend server), `DATABASE_URL` (with `connection_limit` and `pool_timeout`), `DIRECT_URL` (migrations), `REDIS_URL`, `FRONTEND_ORIGINS`, `SUPER_ADMIN_PHONE`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `OTP_SECRET` (all different), `MSG91_*`, `DAILY_SMS_CAP`, `CLOUDINARY_*`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `GEMINI_API_KEY`, `GEMINI_CHAT_MODEL`, `GEMINI_EMBED_MODEL`, `AI_DAILY_LIMIT`.

---

## 8. Known limits and the plan for bigger scale

Load-tested with 50k products (`npm run test:load`, results in README → Tests): one server process served 1,000 shoppers at once (about 140 API calls a second) with no errors and 95% of calls within 1 second; above that its CPU was full while Postgres and Redis were mostly idle. Before lakhs of products or thousands of users at once, in this order:

1. Run 2–3 server copies behind the platform's load balancer; set `TRUST_PROXY_HOPS` to the number of proxies; keep (copies × `connection_limit`) under the database limit; one shared Redis with enough memory.
2. Raise `DAILY_SMS_CAP` and `AI_DAILY_LIMIT` for real traffic.
3. Cache clearing: `clearCache()` drops everything. At high order/review volume, clear only the changed product's keys for reviews and stock changes and keep the global clear for admin catalogue changes.
4. `getVocabulary` reads every product's colours and specs; give it its own long-lived key refreshed by a job when products pass ~50k.
5. Slow common-word searches at lakhs of products: check `EXPLAIN ANALYZE`, rank a top-N subquery first; move text search to Meilisearch/Typesense only if still slow.
6. `applySale` on all products is one big `UPDATE`; batch it above ~50k products.
7. Assistant: guest limits are per IP (shared mobile IPs); chat history comes from the browser (keep it server-side if Gemini answers must not be steered); no COD amount limit yet.
8. The sitemap lists only home-page products; add a product sitemap from the API for SEO at scale.
