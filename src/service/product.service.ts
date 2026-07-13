import { Prisma } from "@prisma/client";
import { prisma } from "../config/db";
import { cache } from "../utils/cache";
import { AppError } from "../utils/appError";
import { PaginatedResult } from "../types";

// Listing ka public shape (admin-only fields chhod ke).
type ProductListItem = {
  id: string;
  name: string;
  slug: string;
  pricePaise: number;
  discountPercent: number;
  images: string[];
  stock: number;
};

const LIST_SELECT = {
  id: true,
  name: true,
  slug: true,
  pricePaise: true,
  discountPercent: true,
  images: true,
  stock: true,
} satisfies Prisma.ProductSelect;

type ListFilters = {
  q?: string;
  categoryId?: string;
  brandId?: string;
  color?: string;
  minPrice?: number;
  maxPrice?: number;
  sort: "newest" | "price_asc" | "price_desc";
  cursor?: string;
  limit: number;
};

// Filters ko Prisma where me badalta hai (sirf active products public ko dikhte hain).
// categoryIds already resolve ho chuki (parent -> khud + children) — neeche list() me hota hai.
function buildWhere(f: ListFilters, categoryIds?: string[]): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { isActive: true };
  if (categoryIds && categoryIds.length > 0) where.categoryId = { in: categoryIds };
  if (f.brandId) where.brandId = f.brandId;
  if (f.color) where.color = { equals: f.color, mode: "insensitive" };

  // SELLING price (discount ke baad) pe filter — user screen pe yahi price dekhta hai.
  // ₹3299 MRP wala 30% off (sell ₹2309) "under 3000" me AANA chahiye (Flipkart jaisa).
  if (f.minPrice !== undefined || f.maxPrice !== undefined) {
    where.sellPaise = {};
    if (f.minPrice !== undefined) where.sellPaise.gte = f.minPrice * 100;
    if (f.maxPrice !== undefined) where.sellPaise.lte = f.maxPrice * 100;
  }
  return where;
}

// "mens jeans under 2000", "mobile 10k se kam", "between 500 and 2k" jaise queries se
// price intent nikaalo. Matched phrase query se hat jaata hai (baaki text pe search hota hai).
// Amount: "2000", "2,000", "2k", "1.5 lakh" sab chalta hai. English + Hinglish dono.
function parseAmount(num: string, unit?: string): number {
  const n = parseFloat(num.replace(/,/g, ""));
  if (!Number.isFinite(n)) return NaN;
  const u = (unit ?? "").toLowerCase();
  if (u === "k") return Math.round(n * 1000);
  if (u === "lakh" || u === "lac") return Math.round(n * 100000);
  return Math.round(n);
}

const AMT = String.raw`(?:rs\.?|₹)?\s*([\d,]+(?:\.\d+)?)\s*(k|lakh|lac)?`;
const PRICE_PATTERNS: { re: RegExp; kind: "max" | "min" | "range" }[] = [
  { re: new RegExp(String.raw`\bbetween\s+${AMT}\s+(?:and|to)\s+${AMT}`, "i"), kind: "range" },
  { re: new RegExp(String.raw`\b${AMT}\s*(?:-|to)\s*${AMT}\s*(?:me|mein|range)?\b`, "i"), kind: "range" },
  { re: new RegExp(String.raw`\b(?:under|below|upto|up\s*to|less\s+than|max(?:imum)?)\s+${AMT}`, "i"), kind: "max" },
  { re: new RegExp(String.raw`\b${AMT}\s*(?:se\s+kam|ke\s+niche|ke\s+andar|tak)\b`, "i"), kind: "max" },
  { re: new RegExp(String.raw`\b(?:above|over|more\s+than|min(?:imum)?)\s+${AMT}`, "i"), kind: "min" },
  { re: new RegExp(String.raw`\b${AMT}\s*(?:se\s+(?:zyada|upar|adhik))\b`, "i"), kind: "min" },
];

export function parsePriceIntent(
  q: string
): { q: string; minPrice?: number; maxPrice?: number } {
  for (const { re, kind } of PRICE_PATTERNS) {
    const m = q.match(re);
    if (!m) continue;
    const cleaned = q.replace(re, " ").replace(/\s+/g, " ").trim();
    if (kind === "range") {
      const a = parseAmount(m[1], m[2]);
      const b = parseAmount(m[3], m[4]);
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      return { q: cleaned, minPrice: Math.min(a, b), maxPrice: Math.max(a, b) };
    }
    const v = parseAmount(m[1], m[2]);
    if (!Number.isFinite(v) || v <= 0) continue;
    return kind === "max" ? { q: cleaned, maxPrice: v } : { q: cleaned, minPrice: v };
  }
  return { q };
}

// Parent category chuni to uske saare subcategory products bhi dikhne chahiye
// (products sirf subcategory pe hote hain, parent pe direct nahi). Isliye
// categoryId ko [khud + children] me expand karte hain.
async function resolveCategoryIds(categoryId: string): Promise<string[]> {
  const children = await prisma.category.findMany({
    where: { parentId: categoryId },
    select: { id: true },
  });
  return [categoryId, ...children.map((c) => c.id)];
}

function buildOrderBy(
  sort: ListFilters["sort"]
): Prisma.ProductOrderByWithRelationInput {
  // Price sort bhi selling price pe — user ko wahi order dikhna chahiye jo price dikh raha hai.
  if (sort === "price_asc") return { sellPaise: "asc" };
  if (sort === "price_desc") return { sellPaise: "desc" };
  return { createdAt: "desc" }; // newest
}

// Single-flight map — same cache-miss ke concurrent requests ek hi DB query share karein.
const inflightLists = new Map<string, Promise<PaginatedResult<ProductListItem>>>();

// Filler/stop words — "iphone ka stock kitna hai" me "ka/kitna/hai" product me nahi
// milte, aur tsquery AND karta hai -> pura search fail. Inhe hata do (Hindi + English).
const STOP_WORDS = new Set([
  // Hindi/Hinglish
  "ka", "ki", "ke", "ko", "me", "mein", "se", "par", "aur", "ya", "hai", "hain",
  "ho", "kya", "kitna", "kitne", "kaun", "wala", "wale", "wali", "mujhe", "muje",
  "chahiye", "dikhao", "dikha", "batao", "bata", "karo", "do", "liye", "lena",
  "accha", "acha", "sabse", "koi", "kuch", "uplabdh", "abhi", "milega", "milta",
  // English
  "i", "a", "an", "the", "of", "to", "in", "is", "are", "my", "for", "me",
  "want", "need", "show", "find", "buy", "get", "please", "some", "any", "best",
  "available", "store", "shop", "online", "there", "you", "have", "sell",
]);

// User ke words ko tsquery me badlo — plural/possessive variants ke saath.
// "mens jeans" -> "(mens | men) & (jeans | jean)" — isse "mens" DB ke "Men's" (token: men)
// se bhi match karta hai aur "jean" likho to "jeans" bhi milta hai. Input sanitize hota hai
// (sirf a-z0-9), isliye tsquery syntax injection nahi ho sakta.
// Exported — assistant (AI chat) bhi yahi variants use karta hai (search consistent rahe).
export function buildTsQuery(term: string): string {
  const words = term
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP_WORDS.has(w))
    .slice(0, 8); // bahut lambi query pe bhi predictable rahe
  return words
    .map((w) => {
      const variants = new Set([w]);
      if (w.length > 3 && w.endsWith("s")) variants.add(w.slice(0, -1)); // mens -> men
      if (w.length > 2 && !w.endsWith("s")) variants.add(`${w}s`); // jean -> jeans
      return `(${[...variants].join(" | ")})`;
    })
    .join(" & ");
}

export const productService = {
  // Listing + filter. Cursor pagination — offset NAHI (50k+ pe offset deep page slow).
  // Full-text search alag path se (neeche searchProducts) kyunki tsvector raw SQL chahiye.
  //
  // SCALE: first page (no cursor) 60s Redis micro-cache me — traffic ka 90%+ first
  // page hota hai, DB har request pe hit na ho. Admin edit ke baad max 60s purana
  // data dikh sakta hai (TTL chhota isi liye hai). Deep pages (cursor) cache nahi hote.
  async list(f: ListFilters): Promise<PaginatedResult<ProductListItem>> {
    // "jeans under 2000" / "10k se kam" — price intent query se nikaal ke filter bana do.
    // Explicit min/maxPrice params ko override nahi karta.
    if (f.q) {
      const intent = parsePriceIntent(f.q);
      f = {
        ...f,
        q: intent.q || undefined,
        minPrice: f.minPrice ?? intent.minPrice,
        maxPrice: f.maxPrice ?? intent.maxPrice,
      };
    }

    const cacheKey = !f.cursor
      ? `plist:${JSON.stringify([f.q, f.categoryId, f.brandId, f.color, f.minPrice, f.maxPrice, f.sort, f.limit])}`
      : null;
    if (!cacheKey) return f.q ? this.search(f) : this.plainList(f);

    const hit = await cache.get(cacheKey);
    if (hit) return JSON.parse(hit);

    // STAMPEDE GUARD (single-flight): cache-miss pe ek hi DB query chale — baaki saare
    // concurrent requests usi promise ka result share karein. Iske bina viral traffic me
    // ek hi query ki 100+ copies DB pool kha jaati hain (load test me yahi 500s de raha tha).
    const existing = inflightLists.get(cacheKey);
    if (existing) return existing;

    const promise = (async () => {
      try {
        const result = f.q ? await this.search(f) : await this.plainList(f);
        await cache.set(cacheKey, JSON.stringify(result), 60);
        return result;
      } finally {
        inflightLists.delete(cacheKey);
      }
    })();
    inflightLists.set(cacheKey, promise);
    return promise;
  },

  // Bina search-term wali listing (category/brand/color/price filter + sort).
  async plainList(f: ListFilters): Promise<PaginatedResult<ProductListItem>> {
    // Search wala "rank:id" cursor galti se yahan aa jaye to ignore (first page).
    const cursor = f.cursor && !f.cursor.includes(":") ? f.cursor : undefined;

    const categoryIds = f.categoryId ? await resolveCategoryIds(f.categoryId) : undefined;
    const where = buildWhere(f, categoryIds);
    const items = await prisma.product.findMany({
      where,
      select: LIST_SELECT,
      orderBy: buildOrderBy(f.sort),
      take: f.limit + 1, // ek extra -> pata chale aage aur hai ya nahi
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });

    const hasMore = items.length > f.limit;
    const sliced = hasMore ? items.slice(0, f.limit) : items;
    return {
      items: sliced,
      nextCursor: hasMore ? sliced[sliced.length - 1].id : null,
    };
  },

  // Full-text search (Postgres tsvector + GIN index, migration me banaya).
  // websearch_to_tsquery -> user "red shoes nike" jaisa likhe to bhi chale.
  // Sort: rank DESC + id ASC tie-break. Cursor bhi isi order ka hai — "rank:id" —
  // warna page 2 pe products skip/duplicate ho jaate (sirf id-cursor rank order
  // ke saath galat tha).
  async search(f: ListFilters): Promise<PaginatedResult<ProductListItem>> {
    const limit = f.limit;
    const term = f.q as string;
    // Variants wali tsquery ("mens" -> men bhi match kare). Khaali ho to koi result nahi.
    const tsQuery = buildTsQuery(term);
    if (!tsQuery) return { items: [], nextCursor: null };

    // Cursor parse: "rank:id". Galat format ho to first page maan lo.
    let cRank: number | null = null;
    let cId: string | null = null;
    if (f.cursor) {
      const sep = f.cursor.indexOf(":");
      const rank = Number(f.cursor.slice(0, sep));
      const id = f.cursor.slice(sep + 1);
      if (sep > 0 && Number.isFinite(rank) && id) {
        cRank = rank;
        cId = id;
      }
    }

    const cursorClause =
      cRank !== null
        ? Prisma.sql`WHERE t.rank < ${cRank} OR (t.rank = ${cRank} AND t.id > ${cId})`
        : Prisma.empty;

    const categoryIds = f.categoryId ? await resolveCategoryIds(f.categoryId) : undefined;
    const catClause =
      categoryIds && categoryIds.length > 0
        ? Prisma.sql`AND p."categoryId" IN (${Prisma.join(categoryIds)})`
        : Prisma.empty;
    const brandClause = f.brandId
      ? Prisma.sql`AND p."brandId" = ${f.brandId}`
      : Prisma.empty;
    const colorClause = f.color
      ? Prisma.sql`AND LOWER(p.color) = LOWER(${f.color})`
      : Prisma.empty;
    const minClause =
      f.minPrice !== undefined
        ? Prisma.sql`AND p."sellPaise" >= ${f.minPrice * 100}`
        : Prisma.empty;
    const maxClause =
      f.maxPrice !== undefined
        ? Prisma.sql`AND p."sellPaise" <= ${f.maxPrice * 100}`
        : Prisma.empty;

    // Rank subquery me ek baar nikala — cursor comparison + ORDER BY dono use karte hain.
    const rows = await prisma.$queryRaw<(ProductListItem & { rank: number })[]>`
      SELECT t.* FROM (
        SELECT p.id, p.name, p.slug, p."pricePaise", p."discountPercent",
               p.images, p.stock,
               ts_rank(p."searchVector", to_tsquery('simple', ${tsQuery})) AS rank
        FROM "Product" p
        WHERE p."isActive" = true
          AND p."searchVector" @@ to_tsquery('simple', ${tsQuery})
          ${catClause} ${brandClause} ${colorClause} ${minClause} ${maxClause}
      ) t
      ${cursorClause}
      ORDER BY t.rank DESC, t.id ASC
      LIMIT ${limit + 1}
    `;

    const hasMore = rows.length > limit;
    const sliced = hasMore ? rows.slice(0, limit) : rows;
    const last = sliced[sliced.length - 1];

    return {
      // rank internal cheez hai, response me nahi bhejni.
      items: sliced.map(
        ({ rank: _rank, ...item }: ProductListItem & { rank: number }) => item
      ),
      nextCursor: hasMore ? `${last.rank}:${last.id}` : null,
    };
  },

  // Single product detail (slug se). URL me capital letters aa jayein to bhi mile
  // (slugs DB me hamesha lowercase hain). Redis cache 5 min — detail page bahut hit hota hai.
  async getBySlug(rawSlug: string) {
    const slug = rawSlug.toLowerCase();
    const cacheKey = `product:${slug}`;
    const cached = await cache.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const product = await prisma.product.findFirst({
      where: { slug, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        pricePaise: true,
        discountPercent: true,
        stock: true,
        images: true,
        category: { select: { id: true, name: true, slug: true } },
        brand: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!product) throw new AppError("Product not found", 404);

    await cache.set(cacheKey, JSON.stringify(product), 300);
    return product;
  },

  // Filter facets — is category/search me JO brands aur colors actually maujood hain
  // sirf wahi. Isse "books" pe phone brands na dikhein. (Flipkart/Amazon jaisa.)
  // 5 min Redis cache — facets rarely badalte hain, listing ke saath har baar call hota hai.
  async facets(categoryId?: string, q?: string): Promise<{ brands: { id: string; name: string }[]; colors: string[] }> {
    const cacheKey = `pfacets:${categoryId ?? ""}:${q ?? ""}`;
    const hit = await cache.get(cacheKey);
    if (hit) return JSON.parse(hit);

    const result = await this.computeFacets(categoryId, q);
    // 30 min TTL — brand/color set kabhi-kabhi hi badalta hai. Server boot pe prewarm
    // hota hai (warmFacets), isliye user ko practically kabhi cold hit nahi milta.
    await cache.set(cacheKey, JSON.stringify(result), 1800);
    return result;
  },

  // Saari top categories ke facets pehle se bana ke cache me rakho (boot + har 25 min).
  // Isse filter panel hamesha instant khulta hai — "brand list slow" kabhi nahi.
  async warmFacets(): Promise<void> {
    const tops = await prisma.category.findMany({
      where: { parentId: null, isActive: true },
      select: { id: true },
    });
    await this.facets(undefined, undefined); // "all products" listing ke liye
    for (const t of tops) {
      await this.facets(t.id, undefined);
    }
  },

  async computeFacets(categoryId?: string, q?: string): Promise<{ brands: { id: string; name: string }[]; colors: string[] }> {
    const categoryIds = categoryId ? await resolveCategoryIds(categoryId) : undefined;

    // "under 3000" jaise price-words query se hatao — warna tsquery unhe products me dhundegi.
    if (q) q = parsePriceIntent(q).q || undefined;

    // Search active ho to matching set se facets (tsvector), warna category se.
    if (q) {
      const catClause =
        categoryIds && categoryIds.length > 0
          ? Prisma.sql`AND p."categoryId" IN (${Prisma.join(categoryIds)})`
          : Prisma.empty;
      // Search() jaisi hi variants wali tsquery — facets aur results hamesha same set pe.
      const tsq = buildTsQuery(q);
      if (!tsq) return { brands: [], colors: [] };
      const tsClause = Prisma.sql`AND p."searchVector" @@ to_tsquery('simple', ${tsq})`;

      // 2-step: pehle DISTINCT brandId (index-only, JOIN nahi), phir naam lookup.
      const brandIdRows = await prisma.$queryRaw<{ brandId: string }[]>`
        SELECT DISTINCT p."brandId" FROM "Product" p
        WHERE p."isActive" = true AND p."brandId" IS NOT NULL ${tsClause} ${catClause}`;
      const brands = await prisma.brand.findMany({
        where: { id: { in: brandIdRows.map((r) => r.brandId) } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
      const colorRows = await prisma.$queryRaw<{ color: string }[]>`
        SELECT DISTINCT p.color FROM "Product" p
        WHERE p."isActive" = true AND p.color IS NOT NULL ${tsClause} ${catClause}
        ORDER BY p.color ASC`;
      return { brands, colors: colorRows.map((r) => r.color) };
    }

    // Bina search — (categoryId, brandId)/(categoryId, color) composite indexes se
    // DISTINCT seedha index scan hai (Prisma ka distinct rows laake dedupe karta tha — slow).
    const catClause =
      categoryIds && categoryIds.length > 0
        ? Prisma.sql`AND "categoryId" IN (${Prisma.join(categoryIds)})`
        : Prisma.empty;
    const brandIdRows = await prisma.$queryRaw<{ brandId: string }[]>`
      SELECT DISTINCT "brandId" FROM "Product"
      WHERE "isActive" = true AND "brandId" IS NOT NULL ${catClause}`;
    const brands = await prisma.brand.findMany({
      where: { id: { in: brandIdRows.map((r) => r.brandId) } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    const colorRows = await prisma.$queryRaw<{ color: string }[]>`
      SELECT DISTINCT color FROM "Product"
      WHERE "isActive" = true AND color IS NOT NULL ${catClause}
      ORDER BY color ASC`;
    return { brands, colors: colorRows.map((r) => r.color) };
  },
};
