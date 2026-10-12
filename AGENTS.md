# AGENTS.md — ApnaKart backend

Rules for anyone (human or AI agent) changing this repo. Read this before writing code.

## What this is

Express + TypeScript REST API for an Indian e-commerce store. Prisma on PostgreSQL (pgvector + pg_trgm), Redis for cache, rate limits, OTP and sessions. Razorpay, MSG91, Cloudinary and Gemini are the only outside services. Target: small-to-medium shop (50k products now, ~2 lakh later) running as one Railway instance.

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
| `utils/` | small pure helpers (price, token, OTP, cookies, pagination) | DB or Redis calls |

One-off jobs run from `server.ts` (`runEvery`), not from scripts.

## Code style

- Write it the way an experienced dev at a small company would: plain, direct, no layers. No repository/DI/DTO classes, no generic helpers "for later", no feature flags, no TODOs, no dead code.
- No comments in code. If something needs explaining, rename it or put it in this file.
- Names a junior can read: `getCart`, `lockOrder`, `checkStock`. No abbreviations.
- Do not split code into many tiny functions. A helper is fine only when it is used in two or more places or it makes the caller clearly shorter.
- Inline a value or object that is used once.
- Constants in `UPPER_CASE` at the top of the file.
- Throw `new AppError(message, status)` for every expected error. Never `try/catch` just to rethrow; `asyncHandler` sends errors to `middleware/error.ts`.
- Every route that takes input has `validate(schema)`. Shared pieces (`uuid`, `idParamSchema`, `pageParams`, `slug`, `phone`) live in `validation/common.ts`.
- Lists use cursor pagination: `pageQuery(cursor, limit)` + `paginate(rows, limit)`.
- Format with Prettier, print width 120 (`npx prettier --print-width 120 --write "src/**/*.ts" prisma/seed.ts`). Run `npm run typecheck` before you finish.

## Data rules

- Money is integer paise everywhere (`pricePaise`, `sellPaise`, `totalPaise`). `finalPrice()` in `utils/price.ts` is the only discount formula; `applySale` in SQL uses the same rounding.
- `sellPaise` is stored so filters and sorts can use an index; recompute it whenever price, discount or offer date changes.
- Products are never deleted, only hidden (`isActive = false`); old orders point to them.
- Category is two levels only. A product is visible when it is active and its category (and parent) is active — use `ACTIVE_CATEGORY` in Prisma queries.
- Customer-facing product data goes through `productCard()` so every list looks the same.
- Concurrency: use `lockUser`, `lockProduct` or `lockOrder` (`SELECT ... FOR UPDATE`) inside `prisma.$transaction` for anything that reads then writes the same rows. Stock is taken with `updateMany({ where: { stock: { gte: qty } } })`.
- Any admin write that changes what shoppers see must call `clearCache()` (it bumps the cache version, so every cached page and AI result is dropped at once).

## Auth and security (do not weaken)

- Access token 15 min (header), refresh token 15 days (HttpOnly cookie, `path=/api/auth`). Session row (`jti`) in DB is the source of truth, cached 60 s in Redis.
- Refresh rotates `jti`; the previous one works for 60 s (two tabs), any other reuse deletes the session.
- Blocking a user, changing a role or deleting an account calls `tokenService.logoutAllDevices`.
- OTP: hashed with `OTP_SECRET`, 2 min life, 60 s resend gap, 5 per hour per phone, `DAILY_SMS_CAP` per day, 3 wrong tries.
- Payment is marked paid only from the server side (signature + Razorpay fetch, or webhook). Webhook events are de-duplicated with `WebhookEvent`.
- CORS origin whitelist is the CSRF protection (frontend and backend are on different domains).

## AI assistant (`service/assistant.*`, `service/embedding.service.ts`)

Order of work for every question — keep it this way, cheapest first:

1. Guards: blocked visitor, unsafe text (3 warnings → 24 h block), small talk, questions about the bot, guest hourly limit.
2. **Instant search** (`readQuestion` → `findProducts` → `searchDb`): parse price (`readBudget`), size, brand, colour, category, who (men/women/kids), sort and offer words into filters, then Postgres full-text (`searchText`) for the left-over words. Cached in Redis by the parsed question.
3. **Embedding search** (`searchByMeaning`): only if instant search found nothing and there are left-over words. Query embedding cached 7 days, results cached like instant search. Distance limit `MAX_DISTANCE`.
4. Rule-based actions without LLM: remove from cart / empty cart / cancel order (`quickAction`).
5. **LLM** (`askAi` with tools): only for logged-in users, inside the quota. Tools must call services, never write SQL that skips service rules.

Rules:

- The assistant answers only from store data. Anything else gets the "only ApnaKart" reply.
- Destructive actions (empty cart, cancel order, admin product change) go through `confirmText` + the pending action in Redis.
- Replies are Hindi/Hinglish or English, chosen by `languageOf`. Add new texts to `REPLIES` in both languages.
- Product embeddings: `embedding` is NULL means "needs embedding". The every-minute job `embeddingService.fillMissing()` fills active products 100 at a time and only saves when `updatedAt` did not change meanwhile. To refresh embeddings after a change, set `embedding = NULL` (see `updateProduct`, `updateBrand`, `updateCategory`); do not call Gemini from request handlers.
- The embedding text is name, brand, parent category, category, gender, age group, colours, sizes, specs and the first 500 characters of the description. If you add a product field that changes meaning, add it to `EMBEDDING_FIELDS` in `admin.service.ts` and to the text in `embedding.service.ts`.

## Database and migrations

- `Product.embedding` is `halfvec(768)` with an HNSW index created in raw SQL; `Product.searchText` is a generated `tsvector` column with a GIN index. Prisma cannot model either fully.
- When you run `prisma migrate dev`, Prisma adds `DROP INDEX "Product_embedding_idx"` (and may touch `searchText`) to the new migration. Delete those lines before applying.
- Never edit an applied migration; add a new one.
- `npm run seed` wipes the DB (development only). Embeddings are filled afterwards by the running server.

## Checks before you finish

1. `npm run typecheck` passes.
2. No comments, no unused exports, no new folders in `src/`.
3. API response shapes unchanged unless the frontend change is part of the task.
4. New admin write → `clearCache()`; text change on products → embedding reset.
