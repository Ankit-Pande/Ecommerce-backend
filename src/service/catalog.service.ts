import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/db";
import { CACHE_SECONDS, getOrSetCache } from "../config/cache";
import { orderByIds, pageQuery, paginate } from "../utils/paginate";
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

const SORT_ORDER: Record<CatalogQuery["sort"], Prisma.ProductOrderByWithRelationInput[]> = {
  latest: [{ createdAt: "desc" }, { id: "desc" }],
  price_asc: [{ sellPaise: "asc" }, { id: "asc" }],
  price_desc: [{ sellPaise: "desc" }, { id: "desc" }],
  discount: [{ discountPercent: "desc" }, { id: "desc" }],
  rating: [{ ratingAverage: "desc" }, { id: "desc" }],
};

const PRICE_NUMBER = String.raw`(\d[\d,]*(?:\.\d+)?)\s*(k|hazar|lakh|lac)?\b`;
const RUPEE_WORD = String.raw`(?:rs\.?|rupees?|rupaye|rupay)?`;
const PRICE_RANGE = new RegExp(String.raw`${PRICE_NUMBER}\s*(?:-|to|se)\s*${PRICE_NUMBER}`, "i");
const PRICE_BELOW = new RegExp(
  String.raw`(?:under|below|upto|up to|less than|max)\s*(?:rs\.?|₹)?\s*${PRICE_NUMBER}|${PRICE_NUMBER}\s*${RUPEE_WORD}\s*(?:tak|(?:ke )?and[ae]r|(?:ke |se )?n(?:ee|i)chh?e|se kam|me|mein|ka|ki|ke)\b`,
  "i",
);
const PRICE_ABOVE = new RegExp(
  String.raw`(?:above|over|more than|min)\s*(?:rs\.?|₹)?\s*${PRICE_NUMBER}|${PRICE_NUMBER}\s*${RUPEE_WORD}\s*(?:se upar|se zyada|ke upar)`,
  "i",
);

const MIN_SEARCH_LENGTH = 2;

export const toPaise = (rupees?: number) => (rupees === undefined ? undefined : Math.round(rupees * 100));

// "20" + "k" -> 20000, "1" + "lakh" -> 100000.
function toRupees(digits: string, unit?: string): number {
  const value = Number(digits.replace(/,/g, ""));
  const unitValue = !unit ? 1 : unit.toLowerCase().startsWith("l") ? 100000 : 1000;
  return value * unitValue;
}

// Search text se price nikalo ("under 2000", "10k ke niche", "1000 ka", "500 se upar"); ₹100 se kam ko price mat maano. Bacha text search ke liye do.
export function readBudget(search: string): { text: string; minPrice?: number; maxPrice?: number } {
  const tidy = (text: string) =>
    text
      .replace(/₹|\brs\b\.?/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  const range = search.match(PRICE_RANGE);
  const below = search.match(PRICE_BELOW);
  const above = search.match(PRICE_ABOVE);

  let budget: { minPrice?: number; maxPrice?: number } = {};
  let priceText = "";
  if (range) {
    const low = toRupees(range[1], range[2] ?? range[4]);
    const high = toRupees(range[3], range[4]);
    budget = { minPrice: Math.min(low, high), maxPrice: Math.max(low, high) };
    priceText = range[0];
  } else if (above) {
    budget = { minPrice: toRupees(above[1] ?? above[3], above[2] ?? above[4]) };
    priceText = above[0];
  } else if (below) {
    budget = { maxPrice: toRupees(below[1] ?? below[3], below[2] ?? below[4]) };
    priceText = below[0];
  }

  if (!priceText || (budget.maxPrice ?? budget.minPrice ?? 0) < 100) return { text: tidy(search) };
  return { text: tidy(search.replace(priceText, " ")), ...budget };
}

// Har shabd naam, colour, brand ya category me kahin mile; brand aur category pehle dhoondho taaki search tez ho.
async function matchEveryWord(words: string[]): Promise<Prisma.ProductWhereInput> {
  const conditions = await Promise.all(
    words.map(async (word) => {
      const contains = { contains: word, mode: "insensitive" as const };
      const [brands, categories] = await Promise.all([
        prisma.brand.findMany({ where: { name: contains, isActive: true }, select: { id: true } }),
        prisma.category.findMany({
          where: { OR: [{ name: contains }, { parent: { name: contains } }] },
          select: { id: true },
        }),
      ]);
      return {
        OR: [
          { name: contains },
          { description: contains },
          { color: contains },
          { brandId: { in: brands.map((b) => b.id) } },
          { categoryId: { in: categories.map((c) => c.id) } },
        ],
      };
    }),
  );
  return { AND: conditions };
}

// Search text se kaam ke shabd (max 6).
function searchWords(text: string): string[] {
  return text
    .split(/\s+/)
    .filter((word) => word.length >= MIN_SEARCH_LENGTH)
    .slice(0, 6);
}

// Category, subcategory aur section (trending/featured) ke filter.
function commonFilters(query: {
  category?: string;
  subcategory?: string;
  section?: string;
}): Prisma.ProductWhereInput[] {
  const filters: Prisma.ProductWhereInput[] = [{ isActive: true, category: ACTIVE_CATEGORY }];
  if (query.subcategory) filters.push({ category: { slug: query.subcategory, parentId: { not: null } } });
  if (query.category) {
    filters.push({
      OR: [{ category: { slug: query.category } }, { category: { parent: { slug: query.category } } }],
    });
  }
  if (query.section === "trending") filters.push({ isTrending: true });
  if (query.section === "featured") filters.push({ isFeatured: true });
  return filters;
}

// Galat spelling wali search ("samsng"): naam, brand aur category me milte-julte products; 2 second se zyada lage to ruk jaye.
async function similarSpellingIds(text: string): Promise<string[]> {
  const [, rows] = await prisma.$transaction([
    prisma.$executeRaw`SET LOCAL statement_timeout = '2s'`,
    prisma.$queryRaw<{ id: string }[]>`
      SELECT p."id", similarity(p."name", ${text}) AS score FROM "Product" p
      WHERE p."isActive" = true AND p."name" % ${text}
      UNION
      SELECT p."id", similarity(p."name", ${text}) FROM "Product" p
      WHERE p."isActive" = true AND p."brandId" IN (SELECT "id" FROM "Brand" WHERE "name" % ${text})
      UNION
      SELECT p."id", similarity(p."name", ${text}) FROM "Product" p
      WHERE p."isActive" = true AND p."categoryId" IN (SELECT "id" FROM "Category" WHERE "name" % ${text})
      ORDER BY 2 DESC
      LIMIT 50`,
  ]);
  return rows.map((row) => row.id);
}

export const catalogService = {
  // Product list: search, filter, sort aur pages; kuch na mile to galat spelling wali search (5 minute cache).
  async list(query: CatalogQuery) {
    const budget = readBudget(query.q ?? "");
    const words = searchWords(budget.text);
    if (budget.text.length > 0 && words.length === 0) return { items: [], nextCursor: null };

    const minPaise = query.minPricePaise ?? toPaise(budget.minPrice);
    const maxPaise = query.maxPricePaise ?? toPaise(budget.maxPrice);
    const cacheKey = createHash("sha1")
      .update(JSON.stringify({ ...query, words, minPaise, maxPaise }))
      .digest("hex");

    return getOrSetCache(`catalog:${cacheKey}`, CACHE_SECONDS, async () => {
      const filters = commonFilters(query);
      if (query.brand) filters.push({ brand: { slug: { in: query.brand }, isActive: true } });
      if (query.color) filters.push({ color: { in: query.color } });
      if (query.gender) filters.push({ gender: { in: query.gender } });
      if (query.ageGroup) filters.push({ ageGroup: { in: query.ageGroup } });
      if (minPaise !== undefined) filters.push({ sellPaise: { gte: minPaise } });
      if (maxPaise !== undefined) filters.push({ sellPaise: { lte: maxPaise } });
      if (query.discount) {
        filters.push({
          discountPercent: { gt: 0 },
          OR: [{ offerEndsAt: null }, { offerEndsAt: { gt: new Date() } }],
        });
      }

      const rows = await prisma.product.findMany({
        where: { AND: words.length > 0 ? [...filters, await matchEveryWord(words)] : filters },
        select: CARD_SELECT,
        orderBy: SORT_ORDER[query.sort],
        ...pageQuery(query.cursor, query.limit),
      });

      if (words.length > 0 && rows.length === 0 && !query.cursor) {
        const ids = await similarSpellingIds(words.join(" "));
        if (ids.length === 0) return { items: [], nextCursor: null };
        const similarRows = await prisma.product.findMany({
          where: { AND: [...filters, { id: { in: ids } }] },
          select: CARD_SELECT,
        });
        return { items: orderByIds(similarRows, ids).slice(0, query.limit).map(productCard), nextCursor: null };
      }

      const page = paginate(rows, query.limit);
      return { items: page.items.map(productCard), nextCursor: page.nextCursor };
    });
  },

  // Sidebar filter: is category ke brands aur colours.
  async filters(query: { category?: string; subcategory?: string }) {
    const cacheKey = `filters:${query.category ?? ""}:${query.subcategory ?? ""}`;
    return getOrSetCache(cacheKey, CACHE_SECONDS, async () => {
      const where: Prisma.ProductWhereInput = { AND: commonFilters(query) };
      const [brands, colors] = await Promise.all([
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
      ]);

      return {
        brands,
        colors: colors.map((row) => row.color as string),
      };
    });
  },
};
