import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/db";
import { getOrSetCache } from "../config/redis";
import { ACTIVE_CATEGORY, CARD_SELECT, productCard } from "../utils/price";
import { ON_OFFER, readQuestion, searchIds, VISIBLE_PRODUCT } from "./assistant.search";

type Sort = "latest" | "price_asc" | "price_desc" | "discount" | "rating";

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
  minRating?: number;
  sort?: Sort;
  cursor?: string;
  limit: number;
};

const SEARCH_RESULTS = 500;
const NO_RESULTS = { items: [], nextCursor: null };

// ORDER BY for one column (ties broken by id) and the condition "comes after the cursor product" in that order.
function sortBy(column: string, direction: "ASC" | "DESC") {
  const field = Prisma.raw(`"${column}"`);
  const order = Prisma.raw(direction);
  const after = Prisma.raw(direction === "ASC" ? ">" : "<");
  return {
    order: Prisma.sql`product.${field} ${order}, product."id" ${order}`,
    after: (cursor: string) =>
      Prisma.sql`(product.${field}, product."id") ${after} (SELECT ${field}, "id" FROM "Product" WHERE "id" = ${cursor})`,
  };
}

const SORTS: Record<Sort, ReturnType<typeof sortBy>> = {
  latest: sortBy("createdAt", "DESC"),
  price_asc: sortBy("sellPaise", "ASC"),
  price_desc: sortBy("sellPaise", "DESC"),
  discount: sortBy("discountPercent", "DESC"),
  rating: sortBy("ratingAverage", "DESC"),
};

// SQL conditions for the filters picked on the page: category, section, brand, colour, size, who, price, offer, rating.
function pageFilters(query: CatalogQuery): Prisma.Sql[] {
  const where: Prisma.Sql[] = [];
  if (query.category) {
    where.push(Prisma.sql`product."categoryId" IN (SELECT category."id" FROM "Category" category
      LEFT JOIN "Category" parent ON parent."id" = category."parentId"
      WHERE category."slug" = ${query.category} OR parent."slug" = ${query.category})`);
  }
  if (query.subcategory) {
    where.push(Prisma.sql`product."categoryId" IN (SELECT "id" FROM "Category"
      WHERE "slug" = ${query.subcategory} AND "parentId" IS NOT NULL)`);
  }
  if (query.section === "trending") where.push(Prisma.sql`product."isTrending"`);
  if (query.section === "featured") where.push(Prisma.sql`product."isFeatured"`);
  if (query.brand) {
    where.push(Prisma.sql`product."brandId" IN (SELECT "id" FROM "Brand"
      WHERE "isActive" AND "slug" IN (${Prisma.join(query.brand)}))`);
  }
  if (query.color) where.push(Prisma.sql`product."colors" && ARRAY[${Prisma.join(query.color)}]::text[]`);
  if (query.size) where.push(Prisma.sql`product."sizes" && ARRAY[${Prisma.join(query.size)}]::text[]`);
  if (query.gender) where.push(Prisma.sql`product."gender" IN (${Prisma.join(query.gender)})`);
  if (query.ageGroup) where.push(Prisma.sql`product."ageGroup" IN (${Prisma.join(query.ageGroup)})`);
  if (query.minPricePaise !== undefined) where.push(Prisma.sql`product."sellPaise" >= ${query.minPricePaise}`);
  if (query.maxPricePaise !== undefined) where.push(Prisma.sql`product."sellPaise" <= ${query.maxPricePaise}`);
  if (query.discount) where.push(ON_OFFER);
  if (query.minRating) where.push(Prisma.sql`product."ratingAverage" >= ${query.minRating}`);
  return where;
}

// One page from a list of ids: cards of the first `limit` ids (hidden products dropped) and the next cursor.
async function pageOf(ids: string[], limit: number) {
  const shown = ids.slice(0, limit);
  const cards = await prisma.product.findMany({
    where: { id: { in: shown }, isActive: true, category: ACTIVE_CATEGORY },
    select: CARD_SELECT,
  });
  const cardById = new Map(cards.map((card) => [card.id, productCard(card)]));
  return {
    items: shown.flatMap((id) => cardById.get(id) ?? []),
    nextCursor: ids.length > limit ? shown[shown.length - 1] : null,
  };
}

// One page of every product that matches `where`, in the chosen sort; the cursor is the last id of the previous page.
async function sortedPage(where: Prisma.Sql[], query: CatalogQuery) {
  const sort = SORTS[query.sort ?? "latest"];
  const conditions = query.cursor ? [...where, sort.after(query.cursor)] : where;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT product."id" FROM "Product" product
    WHERE ${Prisma.join(conditions, " AND ")}
    ORDER BY ${sort.order}
    LIMIT ${query.limit + 1}`;
  return pageOf(
    rows.map((row) => row.id),
    query.limit,
  );
}

// Text search with the assistant's search (page filters included): best match first, or every match in the chosen sort.
async function searchProducts(text: string, query: CatalogQuery, filters: Prisma.Sql[]) {
  const question = await readQuestion(text);
  const askedSomething =
    question.words.length > 0 || Object.keys(question).some((key) => key !== "text" && key !== "words");
  if (!askedSomething) return NO_RESULTS;

  const { ids, match } = await searchIds(question, SEARCH_RESULTS, { where: filters, spelling: true });
  if (ids.length === 0) return NO_RESULTS;
  if (query.sort) return sortedPage([...match, ...filters], query);

  const start = query.cursor ? ids.indexOf(query.cursor) + 1 : 0;
  if (query.cursor && start === 0) return NO_RESULTS;
  return pageOf(ids.slice(start, start + query.limit + 1), query.limit);
}

export const catalogService = {
  // One page of the product list (browse or search), cached for 5 minutes per exact query.
  async list(query: CatalogQuery) {
    const cacheKey = createHash("sha1").update(JSON.stringify(query)).digest("hex");
    return getOrSetCache(`catalog:${cacheKey}`, () => {
      const filters = pageFilters(query);
      return query.q ? searchProducts(query.q, query, filters) : sortedPage([VISIBLE_PRODUCT, ...filters], query);
    });
  },
};
