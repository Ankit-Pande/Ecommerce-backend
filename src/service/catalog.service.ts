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

// Sort ke options (id se tie-break, taaki page 2 par product repeat na ho).
const SORTS: Record<CatalogQuery["sort"], Prisma.ProductOrderByWithRelationInput[]> = {
  latest: [{ createdAt: "desc" }, { id: "desc" }],
  price_asc: [{ sellPaise: "asc" }, { id: "asc" }],
  price_desc: [{ sellPaise: "desc" }, { id: "desc" }],
  discount: [{ discountPercent: "desc" }, { id: "desc" }],
  rating: [{ ratingAverage: "desc" }, { id: "desc" }],
};

// Search text me price pehchano: "under 2000", "20k tak", "5000 se 20000", "above 1 lakh".
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

const MIN_SEARCH_LENGTH = 2;

const toPaise = (rupees?: number) => (rupees === undefined ? undefined : Math.round(rupees * 100));

// "20" + "k" -> 20000, "1" + "lakh" -> 100000.
function toRupees(digits: string, unit?: string): number {
  const value = Number(digits.replace(/,/g, ""));
  const unitValue = !unit ? 1 : unit.toLowerCase().startsWith("l") ? 100000 : 1000;
  return value * unitValue;
}

// Search text se budget nikalo aur bacha hua text search ke liye do.
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

  // ₹100 se kam ko price mat maano ("32 to 43 inch tv" budget nahi hai).
  if (!matched || (budget.maxPrice ?? budget.minPrice ?? 0) < 100) return { text: clean(q) };
  return { text: clean(q.replace(matched, " ")), ...budget };
}

// Har shabd kahin bhi mile (naam, colour, brand, category) — "red shoes" bhi mile.
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

// Search text se kaam ke shabd (max 6).
function searchWords(text: string): string[] {
  return text
    .split(/\s+/)
    .filter((word) => word.length >= MIN_SEARCH_LENGTH)
    .slice(0, 6);
}

// Category, subcategory aur section (trending/featured) ke filter.
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

// Galat spelling wali search ("samsng"); 2 sec se zyada chale to Postgres khud rok de.
async function typoMatchIds(text: string): Promise<string[]> {
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

// Catalog ka ek product (card + colour, brand, category).
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
  // Product list: search + filter + sort + pages (5 min cache).
  async list(query: CatalogQuery) {
    const budget = readBudget(query.q ?? "");
    const words = searchWords(budget.text);
    // Text bacha par koi kaam ka shabd nahi ("a under 2000") — khaali jawab, poora catalog nahi.
    if (budget.text.length > 0 && words.length === 0) return { items: [], nextCursor: null };

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
      // Price filter discount ke baad wale price par.
      if (minPaise !== undefined) filters.push({ sellPaise: { gte: minPaise } });
      if (maxPaise !== undefined) filters.push({ sellPaise: { lte: maxPaise } });
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

      // Kuch nahi mila to galat spelling wali search try karo.
      if (words.length > 0 && rows.length === 0 && !query.cursor) {
        const ids = await typoMatchIds(words.join(" "));
        if (ids.length === 0) return { items: [], nextCursor: null };
        const typoRows = await prisma.product.findMany({
          where: { AND: [...filters, { id: { in: ids } }] },
          select: LIST_SELECT,
        });
        // Sabse milta-julta product upar rahe.
        const position = new Map(ids.map((id, index) => [id, index]));
        typoRows.sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0));
        return { items: typoRows.slice(0, query.limit).map(toItem), nextCursor: null };
      }

      const page = paginate(rows, query.limit);
      return { items: page.items.map(toItem), nextCursor: page.nextCursor };
    });
  },

  // Sidebar filter: is category ke brands, colours aur price range.
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
