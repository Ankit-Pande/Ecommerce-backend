# ApnaKart Backend

REST API for the ApnaKart online store: products, search, cart, checkout, payments, orders, reviews, admin and an AI shopping assistant.

## Tech

Node.js, Express, TypeScript, Prisma (PostgreSQL + pgvector), Redis, Zod, Winston.
Razorpay for payments, MSG91 for OTP SMS, Cloudinary for images, Gemini for the assistant and search embeddings.

## Run on your computer

You need Node.js 20+, PostgreSQL with the `vector` extension (pgvector 0.8+) and Redis.

```bash
npm install
cp .env.example .env        # Windows PowerShell: copy .env.example .env
npx prisma generate
npx prisma migrate deploy   # creates the tables
npm run seed                # optional demo data: 5,000 real-brand products (wipes the DB, dev only)
                            # SEED_PRODUCTS=10000 npm run seed for more (1,000 to 50,000)
npm run dev                 # http://localhost:8000
```

In development the OTP is printed in the server log instead of being sent by SMS.

Generate each secret with `openssl rand -hex 32` and use a different value for each.

## Scripts

| Command | Use |
| --- | --- |
| `npm run dev` | Run with auto reload |
| `npm run build` | Build to `dist/` |
| `npm start` | Run migrations, then start the build |
| `npm run typecheck` | Check types |
| `npm run seed` | Demo data: 5,000 products (`SEED_PRODUCTS` to change) from brands sold in India, 500 users, 3,000 orders. Development only |
| `npm run test:flow` | Every feature once, step by step (see [Tests](#tests)). Development only |
| `npm run test:load -- 1000 120` | 1,000 logged-in shoppers shop together for 120 seconds (see [Tests](#tests)). Development only |
| `npm run format` | Format the code with Prettier (version pinned in `package.json`) |

A file-by-file guide to the code and its main flows is in [CODE-MAP.md](CODE-MAP.md).

## Folders

```text
prisma/        schema, migrations, seed (seed.ts) and its product list (catalog.ts)
src/
  config/      env, db, redis (client + cache), winston, morgan
  routes/      URLs and middleware
  controller/  read the request, call the service, send the response
  service/     business logic
  validation/  Zod request schemas
  middleware/  auth, admin role, rate limit, validation, errors
  integration/ Razorpay, MSG91, Cloudinary, Gemini
  utils/       small pure helpers (price, tokens, cookies, pagination, text)
test/          flow and load tests (development only, not deployed)
```

## API

All responses are `{ success, data }`, `{ success, items, nextCursor }` or `{ success: false, message }`.

| Area | Endpoints |
| --- | --- |
| Health | `GET /health`, `GET /health/ready` |
| Store | `GET /api/home`, `GET /api/catalog` (list, filters, sort and search with `q`) |
| Products | `GET /api/products/:slug`, `/related`, `/reviews` (GET, POST) |
| Auth | `POST /api/auth/send-otp`, `verify-otp`, `refresh`, `logout` |
| User | `/api/user/me` (GET, PATCH, DELETE), `/api/address`, `/api/cart` |
| Orders | `POST /api/order/checkout`, `GET /api/order`, `GET /api/order/:id`, `POST /api/order/:id/payment`, `POST /api/order/:id/verify-payment`, `PATCH /api/order/:id/cancel` |
| Webhook | `POST /api/order/webhook` (Razorpay) |
| Assistant | `POST /api/assistant/chat` (guests and logged-in users) |
| Admin | `/api/admin/stats`, `uploads`, `products`, `products/sale`, `categories`, `brands`, `banners`, `orders`, `users`, `reviews` |

## Search

The store search (`GET /api/catalog?q=...`) and the assistant use the same search engine (`service/assistant.search.ts`), so the search bar understands everything the assistant does: Hindi and Hinglish ("lal juta 7 number 2000 tak"), price, colour, size, brand, category, men/women/kids and model numbers ("iphone 15").

- The filters picked on the page (category, brand, colour, size, price, rating, offers) go into the same SQL as the search, so they apply to every match.
- With no sort the best 500 matches are shown, best first. With a sort (price, newest, discount, rating) every match is sorted in SQL and paged with a cursor, so "jeans, price low to high" starts with the cheapest jeans in the whole store.
- When nothing matches it tries embedding search (if Gemini is set) and then similar spelling ("samsng phone", "smartphon"). The spelling search gives up after 2 seconds and shows no results instead of an error.

## Logs

Every request writes one JSON line: `requestId`, `userId` (when logged in), `method`, `path`, `status`, `ms` and `ip`. Requests slower than 1 second are logged as `warn`, server errors as `error` with the same `requestId`. Each response carries an `X-Request-Id` header, so a user's error can be found in the logs.

## AI assistant

Answers come only from this store's database. Every question goes through the cheapest step first:

1. **Checks** — the question must be plain text: 2 to 300 characters, at most 2 lines, with real words (no HTML, script, only dots or only numbers). Unsafe or prompt-injection text gets a warning; 3 warnings block the visitor for 24 hours. Rate limits: 15 questions a minute, 30 an hour for guests.
2. **Instant search** — the question is read into filters: category, brand, colour, size, price (2k, 2 hazar, 1 lakh, "tak", "se upar", "X se Y"), rating ("4 star se upar"), men/women/kids, cheap/best/new and offers. Hindi and Hinglish words (lal juta, kala, chawal, pampers, लाल जूते) are understood. Everything else is matched against the product name, specs and description with Postgres full-text search, so any product type works ("9 watt led bulb", "20000mah power bank", "laptop bag"):
   - **Spec words** sort by that spec: "achha camera wala phone" puts the most MP first, "long lasting battery wala phone" the most mAh, "zyada storage wala laptop" 1TB before 512GB.
   - **Occasions** (party, wedding/shaadi, festival/diwali, office, gym, travel/tour/trip, college, school, birthday): with a product type ("party ke liye shoes jeans aur tshirt") they put matching products first and mix the asked types; alone ("tour ke liye product dikhao", "festival ke liye kapde") they find products whose text mentions them.
   - Categories, brands, colours and spec names are read from the database, so new products, brands, categories and specs need no code change.

   Size, colour, price and rating are never relaxed: when nothing matches, the reply says what is available instead (other colours, sizes, the cheapest price).
3. **Embedding search** — only when instant search finds nothing. The question's embedding (cached 7 days) is matched against product embeddings with pgvector (looking at no more than the 5,000 nearest products); the result is saved in Redis.
4. **Cart and orders without AI** — "mera cart", "mere orders", "order AB12CD34 kahan hai", remove from cart, empty cart and cancel order are answered by rules. "X cart se hatao" removes X; when X is not in the cart it lists the cart and asks which item. Only "khali / empty / clear / sab" offers to empty the whole cart. "Track", "delivery", "payment" and "address" count as order questions only when no product is named, so "free delivery wale shoes" shows shoes.
5. **LLM (Gemini)** — last, only for logged-in users, only for store questions (anything else is refused before it reaches the LLM), inside their quota (user 20, admin 100 per 5 hours, plus `AI_DAILY_LIMIT` for the whole site). It answers through tools that read this database.

A product the store does not sell ("drone") gets "nothing in the store matches this"; questions outside the store (maths, general knowledge) get the "only ApnaKart" reply. Confirm questions are in Hindi or English like the rest of the chat.

Each answer shows 5 products; "Next 5" pages through the cached list without another search. Redis keeps only the matching product ids (5 minutes, dropped at once on any admin change). Name, price, stock and visibility are always read live from Postgres with the same filters, so a hidden or repriced product, or one whose category was hidden, never comes from the cache. Guests can search; cart and orders need login; admin tools need an admin account, checked against the database on every request. Removing cart items, emptying the cart, cancelling an order and admin product changes ask for "Confirm" first.

Product embeddings stay up to date by themselves: a background job (every minute) fills every active product whose `embedding` is empty, 100 at a time and up to 2,000 per run (a partial index finds them without reading the whole table). Adding a product (one or bulk), editing its name/description/brand/category/colours/sizes/specs, or renaming a brand or category empties the affected embeddings, and every admin change clears the Redis cache. After `npm run seed` the job embeds all products in the background. Without `GEMINI_API_KEY` the assistant still works with instant search and the rule-based cart/order answers.

## Key rules

- Money is always in paise (integer). `₹499` = `49900`.
- An online order is marked paid only after the server checks the Razorpay signature and payment (verify-payment API or webhook), never on the browser's word.
- Stock is reserved at checkout with `UPDATE ... WHERE stock >= qty`, so two buyers cannot get the last item.
- An online order not paid in 30 minutes is cancelled and its stock returned (the job handles up to 2,000 a minute). A user can have 2 unpaid online orders and 10 open COD orders.
- When an unpaid online order is cancelled (by the user or after 30 minutes), its items go back into the user's cart. If the payment still arrives later, the order is flagged for a refund in the admin panel and the stock is not taken again.
- A Razorpay webhook for an order this store does not know (for example another app on the same Razorpay account) is acknowledged and ignored, so Razorpay does not keep retrying it. Webhook ids are kept 30 days to stop duplicates, then deleted by a daily job.
- If Redis goes down, browsing, search, cart, checkout and staying logged in keep working (without cache and rate limits). OTP login and the AI assistant pause until Redis is back, because their limits live in Redis.
- Lists use cursor pagination.
- A product can have many colours and sizes; the customer picks them before adding to cart, and they are saved on the cart line and order line. Stock is one number per product.
- The phone in `SUPER_ADMIN_PHONE` becomes super admin on first login.

## Tests

Both tests start their own API on port 8099 with your `.env` and add test data (users, cancelled orders, a hidden test product) to that database. Run them only on your development database (`NODE_ENV=development`, after `npm run seed`), never with `.env` pointing at the live database.

```bash
npm run test:flow               # every feature once, about 20 seconds
npm run test:load -- 1000 120   # 1,000 shoppers at the same time for 120 seconds
```

`test:flow` prints one line per step: the API, its answer code, the time and what happened. For example:

```text
✔ Home page, second time           GET /api/home                         200     6 ms  from Redis (key cache:4:home, 300 s left): 114 ms -> 6 ms
✔ 31 searches in one minute        GET /api/catalog?q= (31st time)       429     2 ms  blocked: 30 searches a minute per visitor (counter rate:catalog-search:10.9.9.8 in Redis)
✔ Cash on Delivery order           POST /api/order/checkout              201    54 ms  CONFIRMED; stock 121 -> 119 (row lock, no overselling), cart emptied
✔ Webhook: payment captured        POST /api/order/webhook               200    17 ms  order CONFIRMED, payment COMPLETED (signature and amount checked)
✔ Old refresh cookie used again    POST /api/auth/refresh (old cookie)   401    13 ms  looks stolen: session deleted, even the newest cookie stops working
```

Its 38 steps cover the home cache, category pages with the cursor, Hinglish and misspelled search, the search rate limit, OTP login, profile, address, cart, Cash on Delivery checkout and cancel, the Razorpay order and webhook, the assistant, admin product add and hide, the embedding job, logout and refresh-token rotation. Online payment needs Razorpay test keys (the test signs the webhook itself with `RAZORPAY_WEBHOOK_SECRET`, so no public URL is needed) and the embedding step needs `GEMINI_API_KEY`; without them those steps are skipped.

`test:load` logs in that many test shoppers (phones from 6000000000, no SMS) who shop at the same time. Each reads every page for 5–15 seconds and goes: home → a category → a search → a product and its reviews → add to cart → a Cash on Delivery order (1 in 5, cancelled at once so stock stays the same) or remove the item → a question to the assistant (1 in 3, answered from the database, so no AI cost) → my orders. It prints a table per API (calls, 50% / 95% / slowest time, answer codes) and PASS when no call failed (5xx or no answer) and 95% of calls took under 1 second.

Results (October 2026) with 48,534 products on one 2-CPU cloud machine that ran the API (one Node.js process), Postgres, Redis and the test together:

| Shoppers at once | API calls a second | Errors | 95% of calls within | Result |
| --- | --- | --- | --- | --- |
| 500 | 71 | 0 | 65 ms | PASS |
| 1,000 | 139 | 0 | 853 ms | PASS |
| 1,500 | 173 | 0 | 8.4 s | too slow |
| 2,000 | 195 | 0 | 13 s | too slow |
| 3,000 | 207 | 252 calls got no answer | 40 s | failed |

- At 1,000 shoppers half of the reads (home, category, search, product page) answered within 8–27 ms; cart and checkout, which lock rows inside a database transaction, took 0.5–0.9 s.
- Above 1,000 the one Node.js process used a full CPU core while Postgres and Redis stayed mostly idle. On that machine Prisma ran its WebAssembly engine (its normal engine could not be downloaded there), and that engine with the pg driver it needs took more than half of the API's CPU time. Your computer and Railway use the normal engine, so the numbers there are likely better: run `npm run test:load` to see them. For more shoppers, add server copies (Deploy, step 9).
- Earlier, with mostly browsing (about 8% cart and order calls), the same machine answered 200 requests a second with 95% within 61–95 ms. With 2 lakh products, first-time list and search pages took about 20 ms at the median; the slowest was a one-word search ("shoes") in relevance order, about 0.5 s.

## Deploy (Railway)

1. Add PostgreSQL (with pgvector, e.g. Supabase) and Redis, and set every value from `.env.example`. On Supabase use the pooler address (port 6543, add `?pgbouncer=true&connection_limit=20&pool_timeout=20`) for `DATABASE_URL` and the direct address (port 5432) for `DIRECT_URL`. Keep (server copies × `connection_limit`) below the database's connection limit. When every connection stays busy (20 seconds for a query, 10 seconds to start a transaction such as checkout) the API answers 503 "Server busy" instead of 500. Database size: about 100 MB with 10,000 products and 335 MB with 50,000 (the Supabase free plan allows 500 MB and pauses a project after a week without use).
2. Set `NODE_ENV=production`, `LOG_LEVEL=info` and `FRONTEND_ORIGINS` to the frontend URL.
3. Give the frontend and the API one main domain, e.g. `apnakart.in` and `api.apnakart.in`. On `*.vercel.app` + `*.up.railway.app` the login cookie is a third-party cookie: Safari and every iPhone browser block it, so those shoppers are logged out on every page reload.
4. Set `INTERNAL_API_KEY` (`openssl rand -hex 32`) here and the same value in the frontend. The frontend server loads pages for every visitor from one IP; with this key its requests skip the per-IP rate limit (without it a busy store or a Google crawl gets 429s after 300 page loads a minute).
5. Build: `npm run build`, start: `npm start`.
6. Demo products (optional, wipes that database): from your computer, with `NODE_ENV=development` and `DATABASE_URL` / `DIRECT_URL` set to the live database's direct address (port 5432), run `SEED_PRODUCTS=10000 npm run seed`, then point `.env` back to your own database (the tests write test data). The running server fills the embeddings, 2,000 products a minute.
7. In Razorpay, add the webhook `https://<api>/api/order/webhook` for `payment.captured`.
8. Set Redis `maxmemory-policy` to `allkeys-lru`.
9. One instance is enough to start. For more traffic, raise the instance count: the server keeps no state in memory, and each background job takes a Redis lock so only one instance runs it.
