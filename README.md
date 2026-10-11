# ApnaKart Backend

REST API for the ApnaKart online store: products, search, cart, checkout, payments, orders, reviews, admin and an AI shopping assistant.

## Tech

Node.js, Express, TypeScript, Prisma (PostgreSQL), Redis, Zod.
Razorpay for payments, MSG91 for OTP SMS, Cloudinary for images, Gemini for the AI assistant and search embeddings.

## Run on your computer

You need Node.js 20+, PostgreSQL and Redis.

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
| `npm run seed` | Fill demo data: 50,000 products, 500 users, 3,000 orders (development only; set `SEED_PRODUCTS=5000` for fewer) |
| `npm run embed` | Create search embeddings for products that have none |

## Folders

```text
prisma/        schema, migrations, seed
src/
  config/      env, database, redis, cache, logger, cors
  routes/      URLs and middleware
  controller/  read the request, call the service, send the response
  service/     business logic
  validation/  Zod request schemas
  middleware/  auth, admin role, rate limit, validation, errors
  integration/ Razorpay, MSG91, Cloudinary, Gemini
  scripts/     one-off jobs (product embeddings)
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

## Key rules

- Money is always in paise (integer). `₹499` = `49900`.
- An online order is marked paid only after the server checks the Razorpay signature and payment (verify-payment API or webhook), never on the browser's word.
- Stock is reserved at checkout with `UPDATE ... WHERE stock >= qty`, so two buyers cannot get the last item.
- Lists use cursor pagination.
- A product can have many colours and sizes; the customer picks them before adding to cart, and they are saved on the cart line and order line. Stock is one number per product.
- The AI assistant answers only from the store's database. Logged-in users can ask it to remove cart items, empty the cart or cancel an unpaid order; cancelling and emptying ask "Confirm" first.
- The phone in `SUPER_ADMIN_PHONE` becomes super admin on first login.

## Deploy (Railway)

1. Add PostgreSQL and Redis, and set every value from `.env.example`.
2. Set `NODE_ENV=production` and `FRONTEND_ORIGINS` to the frontend URL.
3. Build: `npm run build`, start: `npm start`.
4. In Razorpay, add the webhook `https://<api>/api/order/webhook` for `payment.captured`.
5. Set Redis `maxmemory-policy` to `allkeys-lru`.
