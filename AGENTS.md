# AGENTS.md — ApnaKart backend

Rules for anyone (human or AI agent) changing this repo. Read this before writing code. What each file does is in `CODE-MAP.md`.

## What this is

Express + TypeScript REST API for an Indian e-commerce store. Prisma on PostgreSQL (pgvector + pg_trgm), Redis for cache, rate limits, OTP and sessions. Razorpay, MSG91, Cloudinary and Gemini are the only outside services. Target: small-to-medium shop (5k–10k products for the demo, up to 5 lakh later) on one Railway instance, able to run more instances behind the platform's load balancer.

## Folder rules

`src/` holds only these folders plus `app.ts` and `server.ts`. Do not add new folders (no `modules/`, `scripts/`, `types/`, `helpers/`, `constants/`).

| Folder | Holds | Does not hold |
| --- | --- | --- |
| `config/` | `env`, `db` (Prisma client + row locks), `redis` (client, counters, cache), `winston`, `morgan` | business logic |
| `routes/` | URL → middleware → controller | logic |
| `controller/` | read `req`, call one service, send `{ success, ... }` | Prisma calls |
| `service/` | all business logic and DB access, one object per resource (`export const xService = { ... }`) | `req`/`res` |
| `validation/` | Zod schemas named `xSchema = z.object({ body, query, params })` | logic |
| `middleware/` | auth, role, rate limit, validate, error handler | |
| `integration/` | one file per outside service | DB access |
| `utils/` | small pure helpers (price, token, cookies, pagination, text) | DB or Redis calls |

`test/` sits outside `src/` and is never built or deployed. `flow.ts` (`npm run test:flow`) and `load.ts` (`npm run test:load`) start the API from `src/` on port 8099 with `.env` and write test data, so they refuse to run unless `NODE_ENV=development`. Keep them plain: one `step(...)` per feature in `flow.ts`, one `measure(...)` per API call in `load.ts`, shared code only in `helpers.ts`. When you add or change an API, add or update its step in `flow.ts`.

Background jobs run from `server.ts` (`runEvery`), not from scripts. Each run takes a Redis lock (`job:<name>`, freed when the run ends, 10 minutes at most), so two instances never run the same job at the same time; if Redis is down the job runs anyway. The first run is 10 seconds after start. Keep every run well under 10 minutes: the embedding job does at most 2,000 products per run and the order expiry job at most 2,000 orders; the next minute's run carries on.

## Code style

- Write it the way an experienced dev at a small company would: plain, direct, no layers. No repository/DI/DTO classes, no generic helpers "for later", no feature flags, no TODOs, no dead code.
- Every function (and every service method, route handler and tool `run`/`confirmText`) has exactly one short `//` line right above it that says what it does. No other comments: if a line needs explaining, rename things or put it in this file.
- Names a junior can read: `getCart`, `lockOrder`, `checkStock`. No short names: `question` not `q`, `product` not `p`, `error` not `err`, `response` not `res` (Express's own `req`, `res`, `next` stay). SQL aliases are full words too (`product`, `category`, `parent`).
- Do not split code into many tiny functions. A helper is fine only when it is used in two or more places or it makes the caller clearly shorter.
- Inline a value or object that is used once.
- Constants in `UPPER_CASE` at the top of the file.
- Throw `new AppError(message, status)` for every expected error. Never `try/catch` just to rethrow; `asyncHandler` sends errors to `middleware/error.ts`.
- Every route that takes input has `validate(schema)`. Shared pieces (`uuid`, `idParamSchema`, `pageParams`, `slug`, `phone`) live in `validation/common.ts`.
- Lists use cursor pagination: `pageQuery(cursor, limit)` + `paginate(rows, limit)`. The catalog is the exception: browse and search share SQL filters, so it pages with a keyset cursor in SQL (`sortedPage` in `catalog.service.ts`).
- Format with `npm run format` (Prettier is pinned in `package.json`, print width 120). Run `npm run typecheck` before you finish.

## Data rules

- Money is integer paise everywhere (`pricePaise`, `sellPaise`, `totalPaise`). `finalPrice()` in `utils/price.ts` is the only discount formula; `applySale` in SQL uses the same rounding.
- `sellPaise` is stored so filters and sorts can use an index; recompute it whenever price, discount or offer date changes.
- Products are never deleted, only hidden (`isActive = false`); old orders point to them.
- Category is two levels only. A product is visible when it is active and its category (and parent) is active — use `ACTIVE_CATEGORY` in Prisma queries and `VISIBLE_PRODUCT` (in `assistant.search.ts`) in raw SQL. They are the same rule; change both together.
- Customer-facing product data goes through `productCard()` so every list looks the same.
- Concurrency: use `lockUser`, `lockProduct` or `lockOrder` (`SELECT ... FOR UPDATE`) inside `prisma.$transaction` for anything that reads then writes the same rows. Stock is taken with `updateMany({ where: { stock: { gte: qty } } })`.
- Any admin write that changes what shoppers see must call `clearCache()` (it bumps the cache version, so every cached page and AI result is dropped at once). Orders call it only when a product's stock status changes (in stock / low / out), because cached pages show only the status.
- `getOrSetCache` loads a missing key once per process; other requests for the same key wait for that load, so an expired key cannot send a crowd of queries to Postgres.

## Logs and limits

- `config/morgan.ts` logs one JSON line per request with `requestId`, `userId`, `method`, `path`, `status`, `ms`, `ip` (warn above 1 s, error for 5xx). `app.ts` sets `res.locals.requestId` and the `X-Request-Id` header; the error handler logs unexpected errors with the same fields.
- Rate limits count per user when the request has a valid access token, otherwise per IP (IPv6 by /64, `visitorIp`). The assistant's guest limits and blocks use the same visitor.
- Requests with the header `x-internal-key` equal to `INTERNAL_API_KEY` (compared in constant time) skip every rate limit. Only the frontend's server-side page loads send it; never give it to the browser.

## Auth and security (do not weaken)

- Access token 15 min (header), refresh token 15 days (HttpOnly cookie, `path=/api/auth`). Session row (`jti`) in DB is the source of truth, cached 60 s in Redis.
- Refresh rotates `jti`; the previous one works for 60 s (two tabs), any other reuse deletes the session.
- Blocking a user, changing a role or deleting an account calls `tokenService.logoutAllDevices`.
- OTP: hashed with `OTP_SECRET`, 2 min life, 60 s resend gap (lifted when the SMS fails, so the user can retry at once), 5 per hour per phone, `DAILY_SMS_CAP` per day, 3 wrong tries.
- Payment is marked paid only from the server side (signature + Razorpay fetch, or webhook). Webhook events are de-duplicated with `WebhookEvent`; a webhook for an unknown Razorpay order is logged and answered 200.
- Cancelling an unpaid online order (`cancelUnpaidOrder`, used by user/admin cancel and the expiry job) locks the user row before the product rows (same order as checkout, so no deadlock) and puts the items back in the cart. COD cancels do not touch the cart.
- Rate limiters on reads, cart, checkout, verify-payment and refresh use `allowIfRedisDown: true`; OTP and the assistant fail closed (their limits must hold).
- CORS origin whitelist is the CSRF protection (frontend and backend are on different domains).

## Store search

`GET /api/catalog?q=` uses the assistant's search: `readQuestion` → `searchIds(question, 500, { where: pageFilters, spelling: true })`, which runs instant search, then embedding search, then `searchBySpelling` (pg_trgm on product, brand and category names, 2 second limit, errors give no results) until one finds something. The page filters (`pageFilters` in `catalog.service.ts`) are part of that SQL, so they apply to every match, not only to the first 500.

- No `sort`: the best 500 ids in relevance order, cached; pages are cut from that list (`pageOf`).
- A `sort`: `searchIds` also returns `match` (the SQL that matched), and `sortedPage` sorts every match in SQL with a keyset cursor — the same function browse uses.
- Only the shown page's cards are loaded, fresh from the database.
- One or two digit numbers ("iphone 15") are `modelNumbers`: they rank names that contain them but are not required.

## AI assistant (`service/assistant.*`, `service/embedding.service.ts`)

Order of work for every question — keep it this way, cheapest first:

1. Guards: `chatSchema` (2–300 characters, max 2 lines, real words, no HTML/script), blocked visitor, unsafe text (3 warnings → 24 h block), small talk, questions about the bot, guest hourly limit.
2. **Instant search** (`readQuestion` → `findProducts` → `searchDb`): Devanagari words are romanized (`DEVANAGARI`), Hindi words mapped (`ALIASES`), then rating, price (`readBudget`), size, brand, colour (a base colour also matches its shades), category, occasion (`OCCASIONS`), spec name, who (men/women/kids), sort and offer words are read. Left-over words must match the name and specs (`searchText`) or the description (`descriptionText`); name matches rank first, and size/weight words like `5kg` or `128gb` must match.
   - A spec word ("camera", "battery", "ram", "storage") sorts by the number in that spec, high to low (`specValue`; TB, kg and L count 1000×, so 1TB is above 512GB). Spec names are the keys of `Product.specs` whose values mostly start with a number. When no category is named, only products that have that spec are kept.
   - An occasion only boosts when the question names a specific product type (a category without subcategories, whose parent was not asked too). Otherwise it becomes a required word, so "festival ke liye kapde" or "tour ke liye product" only shows products whose text mentions it.
   - Products from other categories whose name has the category word ("Women's Tops → Casual Shirt" for "shirt") count only when the question also names who it is for or has extra words ("laptop bag"); category members always rank first, then the list mixes the asked categories.
   - Redis keeps only the ordered list of matching ids (`ai:db:`, `ai:meaning:`). `liveCards` loads the cards from Postgres on every answer with the same filters (active product, active category, price, colour, size…), so the cache can never show a hidden, deleted or repriced product.
   - When nothing matches, `findAlternative` tells what is available; hard filters are never dropped.
3. **Embedding search** (`searchByMeaning`): only if instant search found nothing and there are left-over words. Query embedding cached 7 days, results cached like instant search. Distance limit `MAX_DISTANCE`. It looks at no more than the 5,000 nearest products (`hnsw.max_scan_tuples`), so a question with no close product stays fast at lakhs of products.
4. Rule-based actions without LLM (`quickAction`): show cart, show orders or one order, remove from cart, empty cart, cancel order. Removing an item that is not in the cart lists the cart and asks which one; only `CART_EMPTY` words ("khali", "empty", "sab"…) offer to empty the whole cart. `isActionText` decides if a message is a cart/order request: `ORDER_WORDS` ("track", "delivery", "payment", "address") count only when no category or brand is named, so "free delivery wale shoes" is a product search.
5. **LLM** (`askAi` with tools): only for logged-in users, only when the question is about the store (action/shopping words or any filter found), inside the quota. Tools must call services, never write SQL that skips service rules.

Rules:

- The assistant answers only from store data. Anything else gets the "only ApnaKart" reply; a question with left-over words that matched nothing ("drone") gets `notFound` ("nothing in the store matches this").
- Categories, brands, colours and numeric spec names are read from the database (`getVocabulary`), so new data needs no code change. Product descriptions should say what the product is for (travel, gym, office, festival…) — that text is what makes usage questions work. Only general language goes in the word lists (`DEVANAGARI`, `ALIASES`, `OCCASIONS`, `FILLER`); never add product names there.
- Answers show `PAGE_SIZE` (5) products; "Next" pages through the cached list.
- Destructive actions (empty cart, cancel order, admin product change) go through `confirmText(user, input, language)` + the pending action in Redis. The confirm question is written in the chat's language.
- Replies are Hindi/Hinglish or English, chosen by `languageOf`. Add new texts to `REPLIES` in both languages.
- Product embeddings: `embedding` is NULL means "needs embedding". The every-minute job `embeddingService.fillMissing()` fills active products 100 at a time (2,000 per run at most) and only saves when `updatedAt` did not change meanwhile. To refresh embeddings after a change, set `embedding = NULL` (see `updateProduct`, `updateBrand`, `updateCategory`); do not call Gemini from request handlers.
- The embedding text is name, brand, parent category, category, gender, age group, colours, sizes, specs and the first 500 characters of the description, cut to 2,000 characters in total (Gemini rejects the whole batch when one text is too long). If you add a product field that changes meaning, add it to `EMBEDDING_FIELDS` in `admin.service.ts` and to the text in `embedding.service.ts`.

## Database and migrations

- `Product.embedding` is `halfvec(768)` with an HNSW index created in raw SQL; `Product.searchText` (name + specs) and `Product.descriptionText` (description) are generated `tsvector` columns with GIN indexes. `Product_missing_embedding_idx` is a partial index (`WHERE "embedding" IS NULL AND "isActive"`) for the embedding job. Prisma cannot model these fully.
- When you run `prisma migrate dev`, Prisma adds `DROP INDEX "Product_embedding_idx"` / `"Product_missing_embedding_idx"` (and may touch `searchText` or `descriptionText`) to the new migration. Delete those lines before applying.
- Never edit an applied migration; add a new one.
- `npm run seed` wipes the DB (development only) and adds 5,000 products (`SEED_PRODUCTS` for 1,000–50,000). Embeddings are filled afterwards by the running server.
- `prisma/catalog.ts` holds the demo products as plain tables. Phones, tablets, laptops, audio, watches, grocery, beauty, bags, home and baby items are real models with their launch or MRP price (one row each, variants after `=`). Clothes and footwear are built from brand lines: each brand has a price factor for its tier, and every product is one colour, the way big Indian stores list them. Keep items, styles and brands of a line compatible (no "Nike formal shoes"), and write the description (`about`) of each category with what it is used for — the assistant's usage search reads it.

## Checks before you finish

1. `npm run typecheck` passes.
2. One comment line above every function and no other comments; no unused exports; no new folders in `src/`.
3. API response shapes unchanged unless the frontend change is part of the task.
4. New admin write → `clearCache()`; text change on products → embedding reset.
5. `npm run test:flow` passes on a seeded development database.
