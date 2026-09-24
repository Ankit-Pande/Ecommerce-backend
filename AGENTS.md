# AGENTS.md

ApnaKart e-commerce backend. Ye file isliye hai ki koi bhi naya dev ya AI agent 10 minute
me poora system samajh jaye — kahan kya rakha hai, kyun rakha hai, aur kya nahi karna hai.

**Stack:** TypeScript · Express 4 · Prisma / PostgreSQL · Redis · Zod
**Integrations:** Razorpay (payment) · MSG91 (OTP SMS) · Cloudinary (images)
**Deploy:** Railway · **Frontend:** Next.js, alag domain par

---

## 0. Pehle ye padho — 10 hard rules

Ye rules negotiable nahi hain. Koi bhi change inke khilaf jaata ho to change galat hai.

1. **Koi naya folder nahi.** `src/` me sirf 8 folder hain. Repository pattern, DI container,
   DTO layer, service interface, abstract class, barrel file, event bus — kuch nahi.
2. **Koi dead code nahi.** No TODO, no commented-out code, no unused export, no
   "baad me kaam aayega" helper, no speculative config flag.
3. **Business logic sirf `service/` me.** Controller 3-5 line ka hai: req se data lo, service
   bulao, res bhejo. Route me sirf URL + middleware + controller ka naam.
4. **`utils/` me kabhi `prisma` ya `redis` import nahi.** Sirf pure function. Agar DB chahiye,
   wo utils nahi, service hai.
5. **Paisa hamesha integer paise me.** `₹499` = `49900`. Float kabhi nahi.
6. **Validation ek hi baar** — Zod middleware me. Service parsed input par bharosa karti hai,
   dobara check nahi karti.
7. **Har list cursor pagination par.** `OFFSET` kabhi nahi. `COUNT(*)` kabhi nahi.
8. **Naam simple aur human.** `getCart`, `finalPrice`, `lockUser` — aise ki ek internship
   level dev padhkar samajh jaye. `CartAggregateRetrievalService` jaisa kuch nahi.
9. **Comment WHY batata hai, WHAT nahi.** Aur romanized Hindi me, kyunki poora codebase
   usi style me hai.
10. **Bahar ki har call `integration/` se.** Service kabhi seedha `fetch` ya SDK nahi chalati.

---

## 1. Folder structure

```
apnakart-backend/
├── prisma/
│   ├── schema.prisma          14 model
│   ├── migrations/            git me commit hona zaroori
│   └── seed.ts                category, brand, product, order, review
├── src/
│   ├── config/         8 file   setup — connection banate hain, band nahi karte
│   ├── utils/          8 file   pure function — DB/Redis import bilkul nahi
│   ├── middleware/     6 file   request ke raaste me
│   ├── integration/    3 file   bahar ki duniya
│   ├── validation/     9 file   Zod schema
│   ├── routes/        11 file   URL → middleware → controller
│   ├── controller/     9 file   patla wrapper
│   ├── service/       12 file   asli logic
│   ├── app.ts                   express setup + middleware ka order
│   └── server.ts                listen, background job, graceful shutdown
├── .env.example
└── AGENTS.md
```

---

## 2. Request ka poora raasta

```
Request
  │
  ├─ helmet                security headers
  ├─ cors                  FRONTEND_ORIGINS whitelist; galat origin = 403
  ├─ morgan → winston      access log (/health skip)
  │
  ├─ POST /api/order/webhook   ← express.json() se PEHLE, express.raw() ke saath
  │                              (Razorpay signature raw body par banta hai)
  ├─ express.json (1mb)
  ├─ /health                   ready par apna rate limit
  │
  └─ /api  + rateLimiter(300/min/IP)
        └─ routes/index.ts
              └─ <module>.routes.ts
                    ├─ rateLimiter (kuch routes par)
                    ├─ authCheck / optionalAuth
                    ├─ roleCheck (admin)
                    ├─ multer (file wale routes)
                    ├─ validate(zodSchema)
                    └─ controller → service → prisma / redis
  │
  ├─ 404 handler
  └─ errorHandler              har error yahin saaf message banti hai
```

Webhook ka `express.raw()` se pehle aana **zaroori** hai. JSON parse ho gaya to bytes badal
jaate hain aur signature kabhi match nahi karega.

---

## 3. `config/` — 8 file

Rule: **config connection banati hai, band nahi karti.** Band karna `server.ts` ka kaam hai,
kyunki wahi jaanta hai SIGTERM kab aaya.

| File | Exports | Kyun aisa hai |
| --- | --- | --- |
| `env.ts` | `env` | Zod se poori `process.env` validate. Galat/missing par `process.exit(1)` — app start hi na ho. `NODE_ENV` na ho to **production** maano, taki galti se dev mode (khula CORS, SMS ki jagah log) live par na chal jaye. Poore codebase me `process.env` kahin aur nahi padha jaata. |
| `db.ts` | `prisma`, `connectDB`, `disconnectDB`, `lockUser` | Ek hi PrismaClient, `globalThis` par cache (dev hot-reload par naya client na bane). `lockUser(tx, userId)` user row lock karta hai — ek user ki cart/address/checkout request ek-ek karke chalein. |
| `redis.ts` | `redis`, `disconnectRedis`, `countHit` | `enableOfflineQueue: false` + `commandTimeout: 1000` — Redis down ho to command turant fail ho, request latke nahi. `countHit` ek Lua script hai: INCR aur pehli baar EXPIRE ek atomic step me, warna expiry chhoot jaye to key hamesha ke liye block kar deti. |
| `winston.ts` | `logger` | Sirf Console transport. Prod me JSON, dev me rangeen text. **File rotation jaanbujhkar nahi** — Railway ephemeral hai, file reboot par ud jaati hai; Railway khud logs collect karta hai. Custom replacer isliye ki Error JSON me `{}` na ban jaye. |
| `morgan.ts` | `requestLogger` | HTTP access log winston me. `/health` skip — uptime ping se log na bhare. Response time yahin se milta hai, "kaun si API slow hai" isi se pata chalta hai. |
| `cors.ts` | `corsOptions` | `FRONTEND_ORIGINS` comma-separated whitelist. `credentials: true`. Origin na ho (Postman, Android) to allow. Dev me sab allow. |
| `helmet.ts` | `helmetConfig` | `helmet()` default. JSON API HTML serve nahi karta, isliye CSP ki lambi config bekaar hai. |
| `cache.ts` | `remember`, `bumpStorefrontCache`, `CACHE_SECONDS` | Redis ke upar ka cache layer. `utils/` me isliye nahi hai ki wo Redis import karta hai — aur `utils/` ka rule hai ki wahan sirf pure function rahenge. |

---

## 4. `utils/` — 8 file, sab pure

| File | Exports |
| --- | --- |
| `appError.ts` | `AppError(message, statusCode)` — expected error; `error.ts` ise seedha client ko bhejta hai |
| `asyncHandler.ts` | `asyncHandler(fn)` — isi wajah se har controller me try/catch nahi hai |
| `token.ts` | `signAccessToken`, `signRefreshToken`, `verifyAccessToken`, `verifyRefreshToken`, `REFRESH_TTL_DAYS` |
| `otp.ts` | `generateOtp()` (crypto, `Math.random` nahi), `hashOtp(phone, otp)` |
| `cookies.ts` | `setRefreshCookie`, `clearRefreshCookie`, `readRefreshCookie` |
| `paginate.ts` | `paginate(rows, limit)` |
| `text.ts` | `titleCase()` — admin colour likhte waqt aur catalog filter padhte waqt, dono jagah ek hi normalization |
| `price.ts` | `finalPrice`, `effectiveDiscount`, `stockStatus`, `rating`, `productCard`, `ACTIVE_CATEGORY`, `LOW_STOCK_AT` |

### `price.ts` sabse important file hai

Discount ka hisaab home, catalog, cart, order, related — sab jagah **isi se** hota hai.
Agar formula 5 jagah copy ho gaya to kisi ek jagah bug rahega hi.

`productCard()` ek hi shape deta hai: `pricePaise` = MRP, `finalPricePaise` = discount ke baad,
`discountPercent`, `stockStatus`, `image`, `rating`. Home, catalog, related, recently-viewed aur
batch — paanchon yahi bhejte hain. Koi bhi nayi list API apna shape na banaye, yahi use kare.
Iska matlab har us select me `ratingSum` aur `ratingCount` hone chahiye jo `productCard()` ko jaata hai.

### `config/cache.ts` ka version trick

```
key = storefront:<version>:<name>

admin kuch bhi badla  →  INCR storefront:version
                      →  purani saari keys apne aap orphan
                      →  TTL par khud mar jaati hain
```

Ek `INCR` se poora public cache naya. **Delete ek bhi nahi.**

`remember()` **"nahi mila" ko bhi cache karta hai** (`null` bhi ek valid cached value hai).
Iske bina koi hazaar galat slug bhejkar har request DB tak pahucha sakta tha — cache me kuch
milta hi nahi, aur DB har baar khaali haath lautti. Isliye `getBySlug`/`getRelated` build ke
andar throw nahi karte, `null` lautate hain aur 404 bahar phenka jaata hai.

Isme single-flight lock bhi hai: version bump hote hi 1000 request ek saath cache miss karti
hain, to lock sirf ek ko milta hai — wahi DB jaati hai, baaki 200ms ruk kar dobara cache dekh
leti hain. Iske bina ek admin edit poore DB ko gira sakta tha.

Redis down ho to `remember()` seedha `build()` chala deta hai — page kabhi band nahi hota.

---

## 5. `middleware/` — 6 file

| File | Kaam |
| --- | --- |
| `authCheck.ts` | Bearer token verify → session zinda hai? → `req.user = { userId, sessionId, role }` |
| `optionalAuth.ts` | Header na ho to guest. Header ho to sahi hona chahiye — galat token guest nahi banta |
| `roleCheck.ts` | `roleCheck("ADMIN", "SUPER_ADMIN")`, hamesha `authCheck` ke baad |
| `rateLimiter.ts` | `rateLimiter({ bucket, windowSec, max, allowOnRedisDown })` |
| `validate.ts` | Zod se body/query/params check, **parsed data wapas `req` par** |
| `error.ts` | Aakhri middleware — central error handler |

### `authCheck` — sirf JWT verify karna kaafi nahi hai

JWT 15 min valid hai, par us beech me user block ho sakta hai, logout kar sakta hai, ya admin
ne role badal diya ho. Isliye **har request par session bhi check hoti hai**:

```
Bearer token
   → JWT verify (algorithms: ["HS256"] pin kiya hua)
   → Redis me session? (60 sec cache)
        mili     → req.user set
        nahi mili → DB dekho
              nahi mili / expired / blocked / deleted → 401
              mili → Redis me 60s cache → req.user set
```

**DB source of truth hai, Redis sirf shortcut.** Redis down ho to `.catch(() => null)` hota hai
aur seedha DB se check ho jaata hai — login tootta nahi, bas thoda slow hota hai.

Access token me **role nahi hota** — sirf `userId` + `sessionId`. Role har request par session se
aata hai, kyunki role badal sakta hai. Block / role change / delete par `revokeAllSessions()`
DB row **aur** Redis key dono uda deta hai, isliye purana token agli request par hi mar jaata hai.

### `rateLimiter` — kis par kya

| Bucket | Kahan | Limit | Redis down par |
| --- | --- | --- | --- |
| `api` | poore `/api` par | 300/min/IP | jaane do |
| `send-otp` | `POST /auth/send-otp` | 20/hour/IP | rok do |
| `verify-otp` | `POST /auth/verify-otp` | 10/min/IP | rok do |
| `refresh` | `POST /auth/refresh` | 30/min/IP | rok do |
| `checkout` | `POST /order/checkout` | 10/min/**user** | rok do |
| `catalog-search` | `GET /catalog` jab `q` ho | 30/min/IP | jaane do |
| `health` | `GET /health/ready` | 60/min/IP | jaane do |
| `webhook` | `POST /api/order/webhook` | 300/min/IP | jaane do |

Phone-level OTP limit yahan nahi, `otp.service.ts` me hai.

Do design points:
- Login user ko `userId` se gina jaata hai, guest ko IP se — ek hi WiFi ke log ek doosre ki
  limit na kha jayein.
- **IPv6 ko /64 tak kaata jaata hai** (`ipKey()`). Ek sasta VPS bhi poora /64 block deta hai —
  crores addresses. Poora address ginoge to har request naya dikhega aur limit bekaar ho jaayegi.

`allowOnRedisDown` ka faisla seedha hai: browsing rukni nahi chahiye, paisa/OTP bina limit ke
chalna nahi chahiye.

### `error.ts` ka order

1. `express.json()` ki error → 400 "Invalid JSON" / 413 "Request too large"
2. `ZodError` → 400, field ka naam ke saath
3. `MulterError` → 400 "File too large. Max 2MB"
4. Prisma `P2002` → 409, `P2003` → 400, `P2025` → 404, `P2034` → 409
5. `AppError` → uska apna status
6. Baaki sab → `logger.error()` + 500 "Internal server error"

**Point 6 sabse important hai:** asli error log me jaata hai, client ko kabhi nahi. Stack trace
client tak pahunchana ek security bug hai.

---

## 6. `integration/` — 3 file

| File | Exports | Zaroori baat |
| --- | --- | --- |
| `msg91.ts` | `sendOtpSms(mobile, otp)` | Dev me SMS nahi jaata, OTP log me chhapta hai — testing free. 10 sec timeout |
| `razorpay.ts` | `createRazorpayOrder()`, `verifyPaymentSignature()`, `verifyWebhookSignature()` | Client **lazy** banta hai (dev me keys khaali ho to app crash na ho). Compare `timingSafeEqual` se |
| `storage.ts` | `upload` (multer), `uploadImage(buffer)`, `uploadFiles(files)` | Memory storage, 2MB cap, mimetype check **aur** magic-byte check |

Magic-byte check isliye hai ki browser ka bheja `mimetype` jhooth ho sakta hai — koi `.exe` ko
`image/png` bolkar bhej sakta hai. File ke pehle bytes se asli type dekha jaata hai (JPEG `FF D8 FF`,
PNG `89 50 4E 47…`, WEBP `RIFF….WEBP`).

---

## 7. `validation/` — 9 file

| File | Schemas |
| --- | --- |
| `common.ts` | `uuid`, `idParams`, `phone`, `slug`, `csv()`, `page()`, `GENDERS`, `AGE_GROUPS` |
| `auth.validation.ts` | `sendOtpSchema`, `verifyOtpSchema` |
| `user.validation.ts` | `updateMeSchema` |
| `address.validation.ts` | `createAddressSchema`, `updateAddressSchema`, `addressIdSchema` |
| `cart.validation.ts` | `addToCartSchema`, `updateCartItemSchema`, `cartItemParamSchema` |
| `catalog.validation.ts` | `catalogSchema`, `catalogFiltersSchema` |
| `product.validation.ts` | `productSlugSchema`, `batchProductSchema`, `listReviewSchema`, `saveReviewSchema` |
| `order.validation.ts` | `checkoutSchema`, `verifyPaymentSchema`, `orderIdSchema`, `listOrderSchema` |
| `admin.validation.ts` | Product / category / brand / banner / order / user ke create + update + list |

### Teen baatein

**1. `GENDERS` aur `AGE_GROUPS` `common.ts` me kyun hain**

Admin ye value set karta hai aur catalog filter isi par chalta hai. Pehle admin free text likh
sakta tha (`men`, `MALE`) aur catalog ka `{ gender: { in: ["Men"] } }` chup-chaap khaali result
deta tha. Ab dono ek hi constant se aate hain — alag ho hi nahi sakte.

**2. Multipart ke chhote converters**

Form-data me sab string aata hai, isliye `admin.validation.ts` me:
- `formBoolean` — `"true"/"false"` → boolean. `z.coerce.boolean()` mat use karna, wo `"false"` ko
  bhi `true` bana deta hai
- `emptyToNull` — khaali string ka matlab "field hatao"
- `clearableText(max)` / `clearableEnum(values)` — same cheez, nullable ke saath

**3. Har body par `.strict()`**

Zod default me unknown key chup-chaap strip karta hai. Wo bura hai: frontend ne galat spelling
wala field bheja aur kabhi pata hi nahi chala. `.strict()` use loud banata hai.

**Search ka minimum 3 character hai**, 1 nahi. Trigram index 3 se neeche kaam hi nahi karta —
1-2 character ki search poori table scan kar deti hai. Yahi check `catalog.service` me dobara
lagta hai, kyunki `readBudget()` budget hataane ke baad text chhota kar sakta hai
("tv under 2000" → "tv").

**Har jagah paise, rupee kahin nahi** — request me bhi, response me bhi. Admin product create/update
bhi `pricePaise` (integer) leta hai. Rupee sirf ek jagah dikhta hai: `catalog.service` ka
`readBudget()`, jo aadmi ke likhe search text ("under 2000") ko padhta hai aur turant paise me
badal deta hai.

---

## 8. `routes/` — 11 file

### Public

| Method | Path |
| --- | --- |
| GET | `/health`, `/health/ready` |
| GET | `/api/home` |
| GET | `/api/catalog`, `/api/catalog/filters` |
| GET | `/api/products/batch?slugs=a,b` |
| GET | `/api/products/:slug` (optionalAuth) |
| GET | `/api/products/:slug/related`, `/api/products/:slug/reviews` |

### Auth

`POST /api/auth/send-otp` · `verify-otp` · `refresh` · `logout`

### Login user

`/api/user/me` (GET PATCH DELETE) · `/api/address[/:id]` · `/api/cart[/:productId]` ·
`/api/cart/clear` · `/api/order/checkout` · `/api/order/verify` · `/api/order[/:id]` ·
`/api/order/:id/payment` · `/api/order/:id/cancel` · `/api/products/:slug/reviews` (POST DELETE) ·
`/api/products/recently-viewed`

### Admin (`authCheck` + `roleCheck`)

`/api/admin/uploads` · `products[/:id]` · `products/bulk` · `categories[/:id]` · `brands[/:id]` ·
`banners[/:id]` · `orders[/:id]` · `orders/:id/status` · `orders/:id/refunded` · `users[/:id]` ·
`users/:id/block` · `users/:id/role` (**sirf SUPER_ADMIN**) · `reviews/:id`

### Route file me dhyan rakhne wali do cheezein

```ts
router.delete("/clear", clearCart);          // ":productId" se PEHLE
router.delete("/:productId", ...);

router.get("/batch", ...);                   // ":slug" se PEHLE
router.get("/recently-viewed", authCheck, ...);
router.get("/:slug", ...);
```

Fixed path hamesha param wale path se pehle, warna `:slug` use bhi pakad lega.

---

## 9. `controller/` — 9 file, sab patle

Ek controller ka poora kaam:

```ts
export const addToCart = asyncHandler(async (req, res) => {
  const cart = await cartService.addItem(req.user!.userId, req.body.productId, req.body.quantity);
  res.json({ success: true, data: cart });
});
```

Koi try/catch nahi, koi `if` nahi, koi DB call nahi. **Agar controller 5 line se bada ho raha hai,
logic galat jagah ja raha hai.**

### Do apvaad, aur sirf do

1. **`razorpayWebhook`** `asyncHandler` me nahi hai. Iska apna try/catch hai kyunki fail hone par
   **jaanbujhkar 500** bhejna hai, taki Razorpay dobara bheje. Normal 400/404 yahan galat hoga.
2. **Admin ke create/update** me image upload controller me hota hai (`uploadFiles(req.files)`),
   service me nahi — service ko `Express.Multer.File` ka pata nahi hona chahiye, wo sirf
   `string[]` URLs leti hai. Isi wajah se `createProduct` me pehle `checkSlugFree()` chalta hai:
   galat request ki image Cloudinary par chadhe hi na.

### Response format — teen shape, bas

```json
{ "success": true, "data": { } }
{ "success": true, "items": [], "nextCursor": "uuid-or-null" }
{ "success": false, "message": "Human readable" }
```

---

## 10. `service/` — 12 file

### `otp.service.ts`

| Function | Kaam |
| --- | --- |
| `send(phone)` | gap (60s, `SET NX`) → hourly (5, sliding) → daily SMS cap → OTP → Redis 2 min → SMS |
| `verify(phone, otp)` | Lua script: sahi → `DEL`, galat → `wrong++`, 3 galat → `DEL` |

**Verify ek hi Lua script me kyun:** agar `GET` → compare → `DEL` teen alag command me karoge,
to ek saath 1000 request bhejkar koi bhi OTP brute-force kar lega. Ek script = ek atomic step.

**Hourly limit sliding kyun:** fixed window me 3:59 par 5 OTP aur 4:01 par 5 aur — do minute me
10 SMS. Redis sorted set se ginti aakhri OTP se peeche ki taraf hoti hai.

OTP Redis me **plain nahi**, `HMAC(phone + OTP, OTP_SECRET)` hash hota hai — Redis leak ho to bhi bekaar.

### `token.service.ts`

| Function | Kaam |
| --- | --- |
| `createSession(userId)` | Nayi Session row + jti → access + refresh |
| `getSessionRole(userId, sessionId)` | Redis 60s → miss par DB → block/deleted/expired check |
| `refreshSession(refreshToken)` | Rotate + reuse detection |
| `logout(refreshToken)` | Session row + Redis key delete |
| `revokeAllSessions(userId)` | Block / role change / delete par sab device logout |
| `deleteExpiredSessions()` | Roz ek baar safai |

**Rotation + reuse detection — is file ka star feature:**

```
refresh aaya
  ├─ jti current hai?        → naya jti do, purana previousJti me, rotatedAt = ab
  ├─ jti previousJti hai
  │    aur 60 sec ke andar?  → wahi naya token do (do tab ki race hai, logout mat karo)
  └─ warna                   → TOKEN CHORI HUA → session delete → 401
```

60 second ka grace isliye ki do browser tab ek saath refresh karein to dusra logout na ho.
Uske baad purana jti dobara aaya = leak = session khatam.

### `auth.service.ts`

`requestOtp`, `verifyOtpAndLogin`. Phone normalize hota hai (`+91 98765-43210` → `9876543210`)
taki ek number ke do format se do account na banein. `SUPER_ADMIN_PHONE` wala number login
karte hi super admin ban jaata hai — seed script ki zaroorat nahi.

### `user.service.ts`

`getMe`, `updateMe`, `deleteAccount`. Delete **soft** hai: order history bachi rahe, personal
data mit jaye, aur phone `deleted_<id>` ho jaye — taki wahi number dobara naya account bana sake.

### `address.service.ts`

`list`, `create`, `update`, `remove`. Max 5. Pehla address auto-default. Default hataya to sabse
naya default ban jaata hai. Har write `lockUser()` ke andar — do tab se ek saath click par do
default na ban jayein.

### `cart.service.ts`

`getCart`, `addItem`, `updateItem`, `removeItem`, `clearCart`.

Do design decisions:
1. **Cart me price store nahi hoti.** Har baar live price se banti hai. Warna kal price badla aur
   user purane price par order kar gaya.
2. **Hidden / out-of-stock item cart me dikhta hai, total me nahi judta.** User ko dikhna chahiye
   ki kya hata, warna cart chup-chaap khaali ho jaata hai.

### `product.service.ts`

`getBySlug`, `getManyBySlugs`, `getRelated`, `recordView`, `getRecentlyViewed`, `expireOffers`.

`recordView` fire-and-forget hai — fail ho to product page phir bhi khulta hai.
`expireOffers` har minute chalta hai: khatam offer ka `discountPercent = 0`, `sellPaise = pricePaise`.

Saari list `productCard()` ka hi shape deti hain — koi apna shape nahi banata.

### `catalog.service.ts`

`list(query)`, `filters({category, subcategory})`.

Search + brand/colour/gender/ageGroup filter + price range + 5 sort + cursor pagination + 5 min cache.
Normal search khaali aaye to `pg_trgm` se typo match (`samsng` → Samsung), aur wo similarity ke
kram me hi wapas aata hai.

**Typo query par `SET LOCAL statement_timeout = '2s'` hai** (transaction ke andar, warna `SET LOCAL`
kaam nahi karta). Bade catalog par ye query mehngi hai — 2 sec se lambi chali to Postgres khud
rok deta hai, poora DB atakta nahi.

`readBudget()` search text se budget nikalta hai — "shoes under 2000", "phone 20k tak",
"5000 se 20000". Mila hua hissa text se hat jaata hai, baaki par search hoti hai.
₹100 se kam ko budget nahi maanta, warna "32 to 43 inch tv" price ban jaata.

### `home.service.ts`

`getHome()` — ek `Promise.all` me 7 query: banner, category+subcategory, brand, trending,
featured, latest, offers. Poora cached. Frontend ko 7 call ki jagah 1.

### `review.service.ts`

`list`, `save`, `remove`, `removeByAdmin`.

**Review sirf `DELIVERED` order wala customer de sakta hai** — fake rating ka rasta band.
`ratingSum` / `ratingCount` / `ratingAverage` product row par maintain hote hain, taki har card
par `AVG()` na chale.

Teeno write raaste `lockProduct()` se shuru hote hain. Agar sirf ek lock leta, to ek saath
review update + delete hone par `ratingCount` galat ho jaata.

### `order.service.ts` — sabse bada aur sabse zaroori

| Function | Kaam |
| --- | --- |
| `checkout()` | Cart → order, stock reserve, Razorpay order |
| `retryPayment()` | Popup band ho gaya tha — deadline ke andar dobara |
| `verifyPayment()` | Browser ka signature check (sirf information) |
| `handlePaymentCaptured()` | Webhook — **yahin order CONFIRM hota hai** |
| `cancel()` | User ya admin — stock wapas |
| `updateStatus()` | Admin: CONFIRMED → SHIPPED → DELIVERED |
| `markRefunded()` | Admin ne dashboard se refund kiya |
| `releaseExpiredOrders()` | Har minute: unpaid order cancel + stock wapas |
| `listForUser()`, `getForUser()` | Cursor pagination |

Poora payment flow §12 me.

### `admin.service.ts`

Product (create / bulk / update / hide / list with `reservedQuantity`), category (2 level enforce),
brand, banner, order list, user block/role/delete.

`checkCanManage()` ka rule: super admin ko koi nahi chhoo sakta; admin ko sirf super admin;
khud par kuch nahi.

---

## 11. `prisma/schema.prisma` — 13 model

| Model | Zaroori index |
| --- | --- |
| `User` | `phone` unique |
| `Session` | `jti` unique, `userId`, `expiresAt` |
| `Address` | `userId` |
| `Category` | `[parentId, isActive]`, GIN trigram on `name` |
| `Brand` | `isActive`, GIN trigram on `name` |
| `Product` | 8 composite + 3 GIN trigram (`name`, `description`, `color`) |
| `Cart` / `CartItem` | `@@unique([cartId, productId])` |
| `Order` | `@@unique([userId, idempotencyKey])`, `razorpayOrderId` unique, `[status, paymentExpiresAt]` |
| `OrderItem` | `orderId`, `productId` |
| `WebhookEvent` | id hi primary key |
| `Review` | `@@unique([productId, userId])`, `[productId, createdAt]` |
| `Banner` | `[isActive, position]` |
| `ProductView` | `@@id([userId, productId])`, `[userId, viewedAt]` |

### Teen design decisions

**1. `sellPaise` denormalized kyun hai**

Price filter aur sort discount ke **baad** wale price par chalna chahiye.
`pricePaise - (pricePaise * discount / 100)` ko `WHERE` me likhoge to index kaam nahi karega —
poori table scan. Isliye wo value column me store hoti hai, aur `admin.service` +
`expireOffers()` use update karte hain.

**2. `OrderItem` me product ka naam/image/price copy kyun**

Kyunki admin kal product ka naam ya price badal dega. Order ek **contract** hai — usme wahi
dikhna chahiye jo customer ne kharida tha. Order kabhi live product table se join karke mat dikhao.

**3. Stock kab wapas aata hai**

Stock `PENDING`, `CONFIRMED`, `SHIPPED`, `DELIVERED` — sab me reserved rehta hai. Sirf
`CANCELLED` par wapas aata hai, aur wo bhi sirf `cancelLockedOrder()` se — isliye double-return
ka rasta hi nahi hai.

---

## 12. Payment flow

**Ek hi niyam sab chalata hai: order CONFIRM sirf webhook se hota hai, browser se kabhi nahi.**
Browser me baitha banda `fetch` badal sakta hai, Razorpay ka server nahi.

### Checkout

```
1. same idempotencyKey pehle aayi?     → wahi purana order lauta do
2. cart padho, total nikalo
3. address + open-order limit check    ← Razorpay call se PEHLE
4. ONLINE ho to Razorpay order banao
5. TRANSACTION:
     user row lock
     saare products ek query me lock (ORDER BY id — deadlock nahi)
     total abhi bhi wahi hai?          → nahi to 409 "Prices changed"
     stock decrement WHERE stock >= qty
       count == 0                      → 409 "Out of stock"
     Order (PENDING) + OrderItems banao
     sirf wahi cart items hatao jo order me gaye
```

**Race condition yahin rukti hai:**

```ts
const updated = await tx.product.updateMany({
  where: { id: line.productId, stock: { gte: line.quantity } },
  data:  { stock: { decrement: line.quantity } },
});
if (updated.count === 0) throw new AppError("Some products went out of stock", 409);
```

`WHERE stock >= qty` **usi query me** hai. Pehle `SELECT` karke phir `UPDATE` karoge to do
request ke beech me stock badal sakta hai. Ek stock, 50 click — pehla jeet jaata hai, baaki 49
ko turant 409.

### Webhook

```
payment.captured
  ├─ signature raw body par sahi?     nahi → 400, kuch mat karo
  ├─ event id pehle aa chuki?         haan → 200, kuch mat karo
  ├─ order row lock
  ├─ paymentStatus PENDING nahi?      → dusri payment hai → needsReview = true
  ├─ deadline ke andar AUR amount sahi?
  │      haan → CONFIRMED + COMPLETED
  └─    nahi → order cancel + stock wapas, COMPLETED + needsReview
```

Teen guard, teen alag hamla rokte hain:
- **Signature** — koi nakli "payment ho gaya" nahi bhej sakta
- **Event id** (`WebhookEvent` table) — Razorpay wahi event 3 baar bheje to bhi ek hi baar process
- **Amount + currency** — ₹1 dekar ₹50,000 ka order confirm nahi hoga

### Baaki cases

| Case | Kya hota hai |
| --- | --- |
| Payment fail / popup band | Kuch nahi. `POST /order/:id/payment` se dobara try, wahi razorpayOrderId |
| 30 min nikal gaye | `releaseExpiredOrders()` har minute — CANCELLED + stock wapas |
| Paisa aaya par order cancel ho chuka | `paymentStatus = COMPLETED` + `needsReview = true` → admin Razorpay dashboard se refund → `PATCH /admin/orders/:id/refunded` |
| COD | Checkout par hi CONFIRMED, `paymentStatus PENDING`. DELIVERED par COMPLETED |

**Auto-refund API jaanbujhkar nahi hai.** Paisa automatically wapas bhejna aisa code path hai
jiska bug seedha paise ka nuksan hai. Chhoti company me admin manually refund karta hai.

### Status machine

```
[*] → PENDING    (ONLINE checkout)
[*] → CONFIRMED  (COD checkout)

PENDING   → CONFIRMED  (webhook)
PENDING   → CANCELLED  (user / deadline)
CONFIRMED → SHIPPED    (admin)
CONFIRMED → CANCELLED  (user / admin)
SHIPPED   → DELIVERED  (admin)
```

Admin sirf aage badha sakta hai. `SHIPPED` ke baad cancel nahi. Paid order yahan se cancel nahi
(refund manual hai).

---

## 13. Security model

| Layer | Kya | Kahan |
| --- | --- | --- |
| Transport | HTTPS (Railway), `secure` cookie | — |
| Headers | helmet default | `config/helmet.ts` |
| Origin | `FRONTEND_ORIGINS` whitelist, galat origin 403 | `config/cors.ts` |
| Auth | OTP → JWT access (15 min, header) + refresh (15 din, httpOnly cookie) | `token.service.ts` |
| Session | DB source of truth, Redis 60s cache, block par turant revoke | `token.service.ts` |
| Role | Access token me role **nahi**, har request par session se | `authCheck.ts` |
| Input | Zod, har route par, `.strict()` | `validation/` |
| SQL | Prisma parameterized; raw bhi tagged template, string concat kabhi nahi | sab jagah |
| Payment | Raw-body HMAC + event-id idempotency + amount/currency check | `order.service.ts` |
| Upload | 2MB cap + mimetype + magic byte | `integration/storage.ts` |
| Abuse | Rate limit (IP /64 ya userId), search timeout, cache single-flight | `middleware/rateLimiter.ts` |
| Secrets | Zod se validate, min 32 char, teeno alag | `config/env.ts` |
| Errors | Asli error sirf log me, client ko generic 500 | `middleware/error.ts` |

### CSRF token kyun nahi hai

Access token **header** me hai, cookie me nahi. Browser attacker ke page se custom header nahi
bhejta, aur cross-origin par preflight lagta hai — isse 95% CSRF surface khatam.

Bacha sirf `POST /api/auth/refresh` jo cookie se chalta hai, aur wo:
- CORS origin whitelist se protected hai
- `SameSite=None; Secure` (frontend alag domain par hai, isliye None zaroori)
- `path: /api/auth` — refresh cookie baaki kisi API par jaati hi nahi

### `TRUST_PROXY_HOPS` — sabse nazuk setting

`app.set("trust proxy", env.TRUST_PROXY_HOPS)`. Ye galat hua to **poora rate limiter bekaar**:
attacker `X-Forwarded-For` bhejkar har request par naya IP dikha sakta hai.

- Sirf Railway → `1`
- Cloudflare + Railway → `2`

**Kabhi guess mat karo.** Deploy se pehle verify:

```ts
router.get("/whoami", (req, res) =>
  res.json({ ip: req.ip, ips: req.ips, xff: req.headers["x-forwarded-for"] }));
```

```bash
curl https://<app>/health/whoami
curl -H "X-Forwarded-For: 1.2.3.4" https://<app>/health/whoami
```

Dono me `ip` same aana chahiye. Doosri call me `1.2.3.4` aaya → hops zyada hai, turant kam karo.

### Jo application code nahi rok sakta

10 Gbps ka volumetric attack Node kabhi nahi rok sakta, chahe code kitna bhi achha ho. Wo layer
edge ki hai — **Cloudflare free plan Railway ke aage lagao**. Application code ka kaam sirf
*sasta* hamla rokna hai, aur wahi ye sab karta hai.

Redis par `maxmemory-policy allkeys-lru` set karna zaroori hai. `noeviction` par memory full
hote hi saari Redis write fail hone lagti hain — rate limiter, session cache, OTP, sab.

---

## 14. `server.ts` — background jobs aur shutdown

```
connectDB()
app.listen()

har minute:  releaseExpiredOrders()   unpaid online order cancel + stock wapas
             expireOffers()           khatam offer ka discount 0

roz:         deleteExpiredSessions()  expire ho chuki session rows

SIGTERM / SIGINT:
  naye request lena band
  → server.close()
  → disconnectDB() + disconnectRedis()
  → exit(0)
  (10 sec me na hua to exit(1))
```

Minute wale job par `running` flag hai — pichhla khatam na hua ho to naya shuru nahi hota.

---

## 15. Scale — 50k se 2 lakh product

2 lakh row Postgres ke liye chhota hai. Row count problem nahi hai, **query shape** hai.

| Jagah | 2 lakh par | Status |
| --- | --- | --- |
| Catalog search `ILIKE '%..%'` | 3+ char par GIN trgm index chalta hai | min length 3 lagi hui hai |
| `typoMatchIds` | Sabse mehngi query | 2s timeout + 30/min rate limit lagi hui hai |
| `filters()` ka `groupBy(color)` + `aggregate` | Bina category ke poori table par | 5 min cache |
| Cursor pagination | Theek hai | `OFFSET` kabhi mat use karna |
| `seed.ts` | 2 lakh row ek `createMany` me nahi | 1000-1000 ke batch me |

**`COUNT(*)` kahin mat lagana.** "1,84,392 products found" dikhane ke liye 2 lakh row ginni
padti hai, har request par. Frontend par "200+ results" ya sirf `nextCursor` dikhao.

`DATABASE_URL` me pool explicit rakho, default par mat chhodo:

```
?connection_limit=10&pool_timeout=10
```

---

## 16. Local par chalane ke liye

```bash
cp .env.example .env          # secrets bharo: openssl rand -hex 32 (teeno alag)
npm install
npx prisma generate
npx prisma migrate dev        # pehli baar: --name init
npx prisma db seed
npm run dev                   # dev me OTP SMS nahi jaata, log me chhapta hai
npm run typecheck             # zero error aana chahiye
```

`prisma/migrations/` git me commit karna **zaroori** hai. Uske bina Railway par
`prisma migrate deploy` kuch nahi karega aur table banenge hi nahi.

---

## 17. Change karne se pehle ye check karo

- [ ] Naya folder to nahi bana raha?
- [ ] Controller 5 line se bada to nahi hua?
- [ ] `utils/` me `prisma` ya `redis` import to nahi kiya?
- [ ] Paisa kahin float me to nahi?
- [ ] Nayi list API me `productCard()` use kiya, apna shape to nahi banaya?
- [ ] Nayi query par index hai?
- [ ] Nayi list cursor pagination par hai?
- [ ] `COUNT(*)` to nahi lagaya?
- [ ] Nayi public API par rate limit ki zaroorat to nahi?
- [ ] Admin kuch badalta hai to `bumpStorefrontCache()` bulaya?
- [ ] Nayi raw query tagged template hai, string concat nahi?
- [ ] Error message me koi internal detail to leak nahi ho rahi?
- [ ] `npm run typecheck` zero error deta hai?
