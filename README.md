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
npm run seed                # optional demo data: 50,000 products (wipes the DB, dev only)
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
| `npm run seed` | Demo data: 50,000 products, 500 users, 3,000 orders (development only; `SEED_PRODUCTS=5000` for fewer) |

## Folders

```text
prisma/        schema, migrations, seed
src/
  config/      env, db, redis (client + cache), winston, morgan
  routes/      URLs and middleware
  controller/  read the request, call the service, send the response
  service/     business logic
  validation/  Zod request schemas
  middleware/  auth, admin role, rate limit, validation, errors
  integration/ Razorpay, MSG91, Cloudinary, Gemini
  utils/       small pure helpers (price, tokens, OTP, pagination)
```

## API

All responses are `{ success, data }`, `{ success, items, nextCursor }` or `{ success: false, message }`.

| Area | Endpoints |
| --- | --- |
| Health | `GET /health`, `GET /health/ready` |
| Store | `GET /api/home`, `GET /api/catalog` |
| Products | `GET /api/products/:slug`, `/related`, `/reviews` (GET, POST) |
| Auth | `POST /api/auth/send-otp`, `verify-otp`, `refresh`, `logout` |
| User | `/api/user/me` (GET, PATCH, DELETE), `/api/address`, `/api/cart` |
| Orders | `POST /api/order/checkout`, `GET /api/order`, `GET /api/order/:id`, `POST /api/order/:id/payment`, `POST /api/order/:id/verify-payment`, `PATCH /api/order/:id/cancel` |
| Webhook | `POST /api/order/webhook` (Razorpay) |
| Assistant | `POST /api/assistant/chat` (guests and logged-in users) |
| Admin | `/api/admin/stats`, `uploads`, `products`, `products/sale`, `categories`, `brands`, `banners`, `orders`, `users`, `reviews` |

## AI assistant

Every question goes through the cheapest step first:

1. **Instant search** — the question is read into filters (price, brand, colour, category, men/women/kids, size, cheap/best/new, offers). The result is looked up in Redis; on a miss it comes from Postgres and is saved in Redis.
2. **Embedding search** — only when instant search finds nothing. The question's embedding (cached 7 days) is matched against product embeddings with pgvector; the result is saved in Redis.
3. **LLM (Gemini)** — only when both find nothing, only for logged-in users, inside their quota (user 20, admin 100 per 5 hours, plus `AI_DAILY_LIMIT` for the whole site). Search and cart/order actions keep working when the quota is over.

Questions outside the store (maths, general knowledge, questions about the bot) are not answered. Removing cart items, emptying the cart, cancelling an order and admin product changes ask for "Confirm" first.

Product embeddings stay up to date by themselves: a background job (every minute) fills every active product whose `embedding` is empty, 100 at a time. Adding a product, editing its name/description/brand/category/colours/sizes/specs, or renaming a brand or category empties the affected embeddings, and every admin change clears the Redis cache. After `npm run seed` the job embeds all products in the background.

## Key rules

- Money is always in paise (integer). `₹499` = `49900`.
- An online order is marked paid only after the server checks the Razorpay signature and payment (verify-payment API or webhook), never on the browser's word.
- Stock is reserved at checkout with `UPDATE ... WHERE stock >= qty`, so two buyers cannot get the last item.
- An online order not paid in 30 minutes is cancelled and its stock returned. A user can have 2 unpaid online orders and 10 open COD orders.
- Lists use cursor pagination.
- A product can have many colours and sizes; the customer picks them before adding to cart, and they are saved on the cart line and order line. Stock is one number per product.
- The phone in `SUPER_ADMIN_PHONE` becomes super admin on first login.

## Deploy (Railway)

1. Add PostgreSQL (with pgvector, e.g. Supabase) and Redis, and set every value from `.env.example`.
2. Set `NODE_ENV=production` and `FRONTEND_ORIGINS` to the frontend URL.
3. Build: `npm run build`, start: `npm start`.
4. In Razorpay, add the webhook `https://<api>/api/order/webhook` for `payment.captured`.
5. Set Redis `maxmemory-policy` to `allkeys-lru`.
