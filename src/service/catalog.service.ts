import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/db";
import { CACHE_SECONDS, remember } from "../config/cache";
import { paginate } from "../utils/paginate";
import { ACTIVE_CATEGORY, CARD_SELECT, productCard } from "../utils/price";

type CatalogQuery = {
  q?: string;
  category?: string;
  subcategory?: string;
  section?: "trending" | "featured";
  brand?: string[];
  color?: string[];
  gender?: string[];
  ageGroup?: string[];
  minPricePaise?: number;
  maxPricePaise?: number;
  discount?: boolean;
  sort: "latest" | "price_asc" | "price_desc" | "discount" | "rating";
  cursor?: string;
  limit: number;
};

const LIST_SELECT = {
  ...CARD_SELECT,
  color: true,
  gender: true,
  ageGroup: true,
  isTrending: true,
  isFeatured: true,
  category: { select: { name: true, slug: true } },
  brand: { select: { name: true, slug: true, isActive: true } },
} satisfies Prisma.ProductSelect;

// id se tie-break — warna same price/date wale products page 2 pe repeat ya skip hote.
const SORTS: Record<CatalogQuery["sort"], Prisma.ProductOrderByWithRelationInput[]> = {
  latest: [{ createdAt: "desc" }, { id: "desc" }],
  price_asc: [{ sellPaise: "asc" }, { id: "asc" }],
  price_desc: [{ sellPaise: "desc" }, { id: "desc" }],
  discount: [{ discountPercent: "desc" }, { id: "desc" }],
  rating: [{ ratingAverage: "desc" }, { id: "desc" }],
};

// Search box se budget: "shoes under 2000", "phone 20k tak", "5000 se 20000", "above 1 lakh".
// Mila hua hissa text se hata dete hain, baaki text pe search hoti hai.
const AMOUNT = String.raw`(\d[\d,]*(?:\.\d+)?)\s*(k|hazar|lakh|lac)?\b`;
const RANGE = new RegExp(String.raw`${AMOUNT}\s*(?:-|to|se)\s*${AMOUNT}`, "i");
const BELOW = new RegExp(
  String.raw`(?:under|below|upto|up to|less than|max)\s*(?:rs\.?|₹)?\s*${AMOUNT}|${AMOUNT}\s*(?:tak|ke andar|ke neeche|se kam)`,
  "i",
);
const ABOVE = new RegExp(
  String.raw`(?:above|over|more than|min)\s*(?:rs\.?|₹)?\s*${AMOUNT}|${AMOUNT}\s*(?:se upar|se zyada|ke upar)`,
  "i",
);

// Validation me bhi yahi limit hai.
const MIN_SEARCH_LENGTH = 2;

const toPaise = (rupees?: number) => (rupees === undefined ? undefined : Math.round(rupees * 100));

function toRupees(digits: string, unit?: string): number {
  const value = Number(digits.replace(/,/g, ""));
  const unitValue = !unit ? 1 : unit.toLowerCase().startsWith("l") ? 100000 : 1000;
  return value * unitValue;
}

function readBudget(q: string): { text: string; minPrice?: number; maxPrice?: number } {
  const clean = (text: string) =>
    text
      .replace(/₹|\brs\b\.?/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  const range = q.match(RANGE);
  const below = q.match(BELOW);
  const above = q.match(ABOVE);

  let budget: { minPrice?: number; maxPrice?: number } = {};
  let matched = "";
  if (range) {
    const low = toRupees(range[1], range[2] ?? range[4]);
    const high = toRupees(range[3], range[4]);
    budget = { minPrice: Math.min(low, high), maxPrice: Math.max(low, high) };
    matched = range[0];
  } else if (below) {
    budget = { maxPrice: toRupees(below[1] ?? below[3], below[2] ?? below[4]) };
    matched = below[0];
  } else if (above) {
    budget = { minPrice: toRupees(above[1] ?? above[3], above[2] ?? above[4]) };
    matched = above[0];
  }

  // "32 to 43 inch tv" / "iphone 13 se 15" budget nahi hai — ₹100 se kam ko price mat maano.
  if (!matched || (budget.maxPrice ?? budget.minPrice ?? 0) < 100) return { text: clean(q) };
  return { text: clean(q.replace(matched, " ")), ...budget };
}

// Har shabd alag dhundha jaata hai aur sab match hone chahiye. Poora phrase ek hi field me
// dhundhoge to "red shoes" kabhi nahi milega — "red" colour me hai aur "shoes" naam me.
function searchWhere(words: string[]): Prisma.ProductWhereInput {
  return {
    AND: words.map((word) => {
      const has = { contains: word, mode: "insensitive" as const };
      return {
        OR: [
          { name: has },
          { description: has },
          { color: has },
          { brand: { name: has, isActive: true } },
          { category: { name: has } },
          { category: { parent: { name: has } } },
        ],
      };
    }),
  };
}

// Search text se kaam ke shabd. Bahut lamba query na ho isliye 6 tak.
function searchWords(text: string): string[] {
  return text
    .split(/\s+/)
    .filter((word) => word.length >= MIN_SEARCH_LENGTH)
    .slice(0, 6);
}

// Category/subcategory/section — filters() aur list() dono isse shuru karte hain.
function baseFilters(query: {
  category?: string;
  subcategory?: string;
  section?: string;
}): Prisma.ProductWhereInput[] {
  const filters: Prisma.ProductWhereInput[] = [{ isActive: true, category: ACTIVE_CATEGORY }];
  if (query.subcategory) filters.push({ category: { slug: query.subcategory, parentId: { not: null } } });
  // Parent category chuni to uski subcategories ke products bhi.
  if (query.category) {
    filters.push({
      OR: [{ category: { slug: query.category } }, { category: { parent: { slug: query.category } } }],
    });
  }
  if (query.section === "trending") filters.push({ isTrending: true });
  if (query.section === "featured") filters.push({ isFeatured: true });
  return filters;
}

// Typo wali search ("samsng") — normal search khaali aaye tabhi. pg_trgm ka % operator.
async function typoMatchIds(text: string): Promise<string[]> {
  // Bade catalog par ye query mehngi hai. Transaction ke andar SET LOCAL lagta hai, isliye
  // 2 second se lambi chali to Postgres khud hi rok deta hai — poora DB atakta nahi.
  const [, rows] = await prisma.$transaction([
    prisma.$executeRaw`SET LOCAL statement_timeout = '2s'`,
    prisma.$queryRaw<{ id: string }[]>`
      SELECT p."id" FROM "Product" p
      LEFT JOIN "Brand" b ON b."id" = p."brandId"
      LEFT JOIN "Category" c ON c."id" = p."categoryId"
      WHERE p."isActive" = true AND (p."name" % ${text} OR b."name" % ${text} OR c."name" % ${text})
      ORDER BY similarity(p."name", ${text}) DESC
      LIMIT 50`,
  ]);
  return rows.map((row) => row.id);
}

function toItem(p: Prisma.ProductGetPayload<{ select: typeof LIST_SELECT }>) {
  return {
    ...productCard(p),
    color: p.color,
    gender: p.gender,
    ageGroup: p.ageGroup,
    isTrending: p.isTrending,
    isFeatured: p.isFeatured,
    category: p.category,
    brand: p.brand?.isActive ? { name: p.brand.name, slug: p.brand.slug } : null,
  };
}

export const catalogService = {
  // Listing + search + filter + sort, cursor pagination. 5 min cache.
  async list(query: CatalogQuery) {
    const budget = readBudget(query.q ?? "");
    const words = searchWords(budget.text);
    // "under 2000" poora budget query hai — sirf price filter sahi hai. Par "a under 2000" me
    // "a" bacha hai jise search nahi kar sakte; use chup-chaap girane par user ko ₹2000 tak ka
    // poora catalog dikh jaata, jo usne maanga hi nahi tha.
    if (budget.text.length > 0 && words.length === 0) return { items: [], nextCursor: null };

    // Query paise me aati hai; search text ("under 2000") se rupee nikalta hai.
    const minPaise = query.minPricePaise ?? toPaise(budget.minPrice);
    const maxPaise = query.maxPricePaise ?? toPaise(budget.maxPrice);
    const cacheKey = createHash("sha1")
      .update(JSON.stringify({ ...query, words, minPaise, maxPaise }))
      .digest("hex");

    return remember(`catalog:${cacheKey}`, CACHE_SECONDS, async () => {
      const filters = baseFilters(query);
      if (query.brand) filters.push({ brand: { slug: { in: query.brand }, isActive: true } });
      if (query.color) filters.push({ color: { in: query.color } });
      if (query.gender) filters.push({ gender: { in: query.gender } });
      if (query.ageGroup) filters.push({ ageGroup: { in: query.ageGroup } });
      // Price sale price (discount ke baad) pe.
      if (minPaise !== undefined) filters.push({ sellPaise: { gte: minPaise } });
      if (maxPaise !== undefined) filters.push({ sellPaise: { lte: maxPaise } });
      // Sirf chalu offer.
      if (query.discount) {
        filters.push({
          discountPercent: { gt: 0 },
          OR: [{ offerEndsAt: null }, { offerEndsAt: { gt: new Date() } }],
        });
      }

      const rows = await prisma.product.findMany({
        where: { AND: words.length > 0 ? [...filters, searchWhere(words)] : filters },
        select: LIST_SELECT,
        orderBy: SORTS[query.sort],
        take: query.limit + 1,
        ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
      });

      // Kuch nahi mila -> typo wali search (baaki saare filter wahi).
      if (words.length > 0 && rows.length === 0 && !query.cursor) {
        const ids = await typoMatchIds(words.join(" "));
        if (ids.length === 0) return { items: [], nextCursor: null };
        const typoRows = await prisma.product.findMany({
          where: { AND: [...filters, { id: { in: ids } }] },
          select: LIST_SELECT,
        });
        // ids similarity ke kram me aaye hain — wahi kram wapas lagao, warna sabse
        // milta-julta product neeche chala jaata hai.
        const position = new Map(ids.map((id, index) => [id, index]));
        typoRows.sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0));
        return { items: typoRows.slice(0, query.limit).map(toItem), nextCursor: null };
      }

      const page = paginate(rows, query.limit);
      return { items: page.items.map(toItem), nextCursor: page.nextCursor };
    });
  },

  // Sidebar: is category me jo brands, colours aur price range maujood hain.
  // Search text se nahi badalta — type karte waqt har letter pe naya cache na bane.
  async filters(query: { category?: string; subcategory?: string }) {
    const cacheKey = `filters:${query.category ?? ""}:${query.subcategory ?? ""}`;
    return remember(cacheKey, CACHE_SECONDS, async () => {
      const where: Prisma.ProductWhereInput = { AND: baseFilters(query) };
      const [brands, colors, price] = await Promise.all([
        prisma.brand.findMany({
          where: { isActive: true, products: { some: where } },
          select: { id: true, name: true, slug: true },
          orderBy: { name: "asc" },
        }),
        prisma.product.groupBy({
          by: ["color"],
          where: { AND: [where, { color: { not: null } }] },
          orderBy: { color: "asc" },
        }),
        prisma.product.aggregate({ where, _min: { sellPaise: true }, _max: { sellPaise: true } }),
      ]);

      return {
        brands,
        colors: colors.map((row) => row.color as string),
        minPricePaise: price._min.sellPaise ?? 0,
        maxPricePaise: price._max.sellPaise ?? 0,
      };
    });
  },
};
