# Ecommerce Backend

Production-ready ecommerce backend. Phone+OTP auth, product catalog (50k+ ready),
cart, Razorpay checkout, admin panel. TypeScript + Express + Prisma + PostgreSQL + Redis.

## Features
- Phone + OTP login (MSG91), JWT (header-based, no cookie), Redis token blacklist
- Product listing: cursor pagination, Postgres full-text search (GIN index), filters (category/brand/price)
- Category + subcategory (self-relation), Brand, Banner (carousel), Trending
- Cart (live pricing/stock), Address (multi + default)
- Checkout: atomic stock reserve -> Razorpay -> webhook confirm/cancel
- Order cancel (user): `PATCH /api/order/:id/cancel` — PENDING/CONFIRMED tak, stock wapas
- Admin: product/category/brand/banner CRUD (Cloudinary images), order management
- Bulk: `POST /api/admin/uploads` (images -> URLs), `POST /api/admin/products/bulk` (max 50)
- Redis caching: trending, product detail, category tree, brands, banners

## Scale
50k products target, architecture 200k-ready (no offset pagination, indexed search, caching).
AI-ready: `searchVector` column + service search layer alag — aage pgvector semantic search plug ho jayega.

## Setup
```bash
npm install
cp .env.example .env   # values bharo
npx prisma migrate deploy   # schema + search_vector trigger/index
npm run seed                # super admin + sample data
npm run dev
```

## Deploy
- Backend: Railway  | DB: Supabase/Neon (Postgres)  | Redis: Upstash
- `DATABASE_URL` pooled ho to `DIRECT_URL` (migration ke liye) bhi set karo
- Razorpay dashboard me webhook URL: `https://<backend>/api/order/webhook`
  events: `payment.captured`, `payment.failed`
- Saare env vars Railway pe set karo (prod me MSG91/Razorpay/Cloudinary mandatory)

## Scripts
- `npm run dev` — local dev (hot reload)
- `npm run build` — prisma generate + tsc
- `npm start` — migrate deploy + run (prod)
- `npm run seed` — seed data
