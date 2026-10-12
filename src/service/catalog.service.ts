import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/db";
import { getOrSetCache } from "../config/redis";
import { pageQuery, paginate } from "../utils/paginate";
import { ACTIVE_CATEGORY, CARD_SELECT, productCard } from "../utils/price";
import { titleCase } from "../utils/text";

export type CatalogQuery = {
  q?: string;
  category?: string;
  subcategory?: string;
  section?: "trending" | "featured";
  brand?: string[];
  color?: string[];
  size?: string[];
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

const NUMBER = String.raw`(\d[\d,]*(?:\.\d+)?)\s*(k|hazar|lakh|lac)?\b`;
const RUPEE_WORD = String.raw`(?:rs\.?|rupees?|rupaye|rupay)?`;
const PRICE_RANGE = new RegExp(String.raw`${NUMBER}\s*(?:-|to|se)\s*${NUMBER}`, "i");
const PRICE_BELOW = new RegExp(
  String.raw`(?:under|below|upto|up to|less than|max)\s*(?:rs\.?|₹)?\s*${NUMBER}|${NUMBER}\s*${RUPEE_WORD}\s*(?:tak|(?:ke )?and[ae]r|(?:ke |se )?n(?:ee|i)chh?e|se kam|me|mein|ka|ki|ke)\b`,
  "i",
);
const PRICE_ABOVE = new RegExp(
  String.raw`(?:above|over|more than|min)\s*(?:rs\.?|₹)?\s*${NUMBER}|${NUMBER}\s*${RUPEE_WORD}\s*(?:se upar|se zyada|ke upar)`,
  "i",
);
const PRICE_BARE = new RegExp(
  String.raw`(₹|\brs\.?)?\s*\b(\d[\d,]*(?:\.\d+)?)\s*(k|hazar|lakh|lac)?\b(?!\s*(?:gb|tb|mb|mah|mp|hz|inch|inches|w|watt|ml|kg|cm|mm|years?|saal|sal|months?|model|number|no|size|uk)\b)`,
  "gi",
);
const MIN_BARE_PRICE = 500;

function toPaise(digits: string, unit?: string): number {
  const rupees = Number(digits.replace(/,/g, ""));
  const multiplier = !unit ? 1 : unit.toLowerCase().startsWith("l") ? 100000 : 1000;
  return Math.round(rupees * multiplier * 100);
}

export function readBudget(search: string): { text: string; minPaise?: number; maxPaise?: number; bare?: boolean } {
  const range = search.match(PRICE_RANGE);
  const above = search.match(PRICE_ABOVE);
  const below = search.match(PRICE_BELOW);

  let budget: { minPaise?: number; maxPaise?: number } = {};
  let priceText = "";
  if (range) {
    const low = toPaise(range[1], range[2] ?? range[4]);
    const high = toPaise(range[3], range[4]);
    budget = { minPaise: Math.min(low, high), maxPaise: Math.max(low, high) };
    priceText = range[0];
  } else if (above) {
    budget = { minPaise: toPaise(above[1] ?? above[3], above[2] ?? above[4]) };
    priceText = above[0];
  } else if (below) {
    budget = { maxPaise: toPaise(below[1] ?? below[3], below[2] ?? below[4]) };
    priceText = below[0];
  } else {
    for (const match of search.matchAll(PRICE_BARE)) {
      const paise = toPaise(match[2], match[3]);
      if (match[1] || match[3] || paise >= MIN_BARE_PRICE * 100) {
        budget = { maxPaise: paise };
        priceText = match[0];
        break;
      }
    }
  }

  const tidy = (text: string) =>
    text
      .replace(/₹|\brs\b\.?/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  if (!priceText || (budget.maxPaise ?? budget.minPaise ?? 0) < 10000) return { text: tidy(search) };

  const bare = !range && !above && !below;
  return { text: tidy(search.replace(priceText, " ")), ...budget, ...(bare && { bare }) };
}

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
          { colors: { has: titleCase(word) } },
          { brandId: { in: brands.map((b) => b.id) } },
          { categoryId: { in: categories.map((c) => c.id) } },
        ],
      };
    }),
  );
  return { AND: conditions };
}

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
      WHERE p."isActive" = true AND p."categoryId" IN (
        SELECT c."id" FROM "Category" c LEFT JOIN "Category" pc ON pc."id" = c."parentId"
        WHERE c."name" % ${text} OR pc."name" % ${text})
      ORDER BY 2 DESC
      LIMIT 50`,
  ]);
  return rows.map((row) => row.id);
}

export const catalogService = {
  async list(query: CatalogQuery) {
    const budget = readBudget(query.q ?? "");
    const words = budget.text
      .replace(/\bt\s?shirt/gi, "t-shirt")
      .split(/\s+/)
      .filter((word) => word.length >= 2)
      .slice(0, 6);
    if (budget.text.length > 0 && words.length === 0) return { items: [], nextCursor: null };

    const minPaise = query.minPricePaise ?? budget.minPaise;
    const maxPaise = query.maxPricePaise ?? budget.maxPaise;
    const cacheKey = createHash("sha1")
      .update(JSON.stringify({ ...query, words, minPaise, maxPaise }))
      .digest("hex");

    return getOrSetCache(`catalog:${cacheKey}`, async () => {
      const filters: Prisma.ProductWhereInput[] = [{ isActive: true, category: ACTIVE_CATEGORY }];
      if (query.category) {
        filters.push({
          OR: [{ category: { slug: query.category } }, { category: { parent: { slug: query.category } } }],
        });
      }
      if (query.subcategory) filters.push({ category: { slug: query.subcategory, parentId: { not: null } } });
      if (query.section === "trending") filters.push({ isTrending: true });
      if (query.section === "featured") filters.push({ isFeatured: true });
      if (query.brand) filters.push({ brand: { slug: { in: query.brand }, isActive: true } });
      if (query.color) filters.push({ colors: { hasSome: query.color } });
      if (query.size) filters.push({ sizes: { hasSome: query.size } });
      if (query.gender) filters.push({ gender: { in: query.gender } });
      if (query.ageGroup) filters.push({ ageGroup: { in: query.ageGroup } });
      if (minPaise !== undefined) filters.push({ sellPaise: { gte: minPaise } });
      if (maxPaise !== undefined) filters.push({ sellPaise: { lte: maxPaise } });
      if (query.discount) {
        filters.push({ discountPercent: { gt: 0 }, OR: [{ offerEndsAt: null }, { offerEndsAt: { gt: new Date() } }] });
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
        const similar = await prisma.product.findMany({
          where: { AND: [...filters, { id: { in: ids } }] },
          select: CARD_SELECT,
        });
        similar.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
        return { items: similar.slice(0, query.limit).map(productCard), nextCursor: null };
      }

      const page = paginate(rows, query.limit);
      return { items: page.items.map(productCard), nextCursor: page.nextCursor };
    });
  },
};
