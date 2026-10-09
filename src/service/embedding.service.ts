import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/db";
import { redis } from "../config/redis";
import { logger } from "../config/winston";
import { embedTexts, geminiReady } from "../integration/gemini";

const BATCH_SIZE = 100;
const QUERY_VECTOR_SECONDS = 7 * 24 * 3600;
const MAX_DISTANCE = 0.45;

type SearchFilters = {
  gender?: string[];
  ageGroup?: string[];
  minPaise?: number;
  maxPaise?: number;
  discount?: boolean;
  trending?: boolean;
};

// AI search ke common filter (SQL me, product "p"): chalu product aur category, gender, age, price, offer, trending.
export function productFilterSql(filters: SearchFilters): Prisma.Sql[] {
  const where: Prisma.Sql[] = [
    Prisma.sql`p."isActive" = true`,
    Prisma.sql`EXISTS (SELECT 1 FROM "Category" c LEFT JOIN "Category" pc ON pc."id" = c."parentId"
      WHERE c."id" = p."categoryId" AND c."isActive" = true AND (pc."id" IS NULL OR pc."isActive" = true))`,
  ];
  if (filters.gender) where.push(Prisma.sql`p."gender" IN (${Prisma.join(filters.gender)})`);
  if (filters.ageGroup) where.push(Prisma.sql`p."ageGroup" IN (${Prisma.join(filters.ageGroup)})`);
  if (filters.minPaise !== undefined) where.push(Prisma.sql`p."sellPaise" >= ${filters.minPaise}`);
  if (filters.maxPaise !== undefined) where.push(Prisma.sql`p."sellPaise" <= ${filters.maxPaise}`);
  if (filters.discount) where.push(Prisma.sql`p."discountPercent" > 0`);
  if (filters.trending) where.push(Prisma.sql`p."isTrending" = true`);
  return where;
}

const toVector = (values: number[]) => `[${values.join(",")}]`;

// Product ka text jisse meaning banta hai: naam, brand, category, kiske liye, colour, description.
async function productTexts(ids: string[]) {
  const rows = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      description: true,
      color: true,
      gender: true,
      ageGroup: true,
      brand: { select: { name: true } },
      category: { select: { name: true, parent: { select: { name: true } } } },
    },
  });
  return rows.map((p) => ({
    id: p.id,
    text: [
      p.name,
      p.brand?.name,
      p.category.parent?.name,
      p.category.name,
      p.gender,
      p.ageGroup,
      p.color,
      p.description.slice(0, 500),
    ]
      .filter(Boolean)
      .join(" | "),
  }));
}

// User ke sawal ka embedding (Redis me 7 din, same sawal par Gemini call nahi).
async function queryVector(text: string): Promise<string> {
  const key = `ai:qvec:${createHash("sha1").update(text.toLowerCase()).digest("hex")}`;
  const cached = await redis.get(key).catch(() => null);
  if (cached) return cached;
  const [values] = await embedTexts([text], "RETRIEVAL_QUERY");
  const vector = toVector(values);
  await redis.set(key, vector, "EX", QUERY_VECTOR_SECONDS).catch(() => null);
  return vector;
}

export const embeddingService = {
  // Products ka embedding banao ya badlo (100-100 karke).
  async syncProducts(ids: string[]) {
    if (!geminiReady || ids.length === 0) return;
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const items = await productTexts(ids.slice(i, i + BATCH_SIZE));
      const vectors = await embedTexts(
        items.map((item) => item.text),
        "RETRIEVAL_DOCUMENT",
      );
      await prisma.$transaction(
        items.map(
          (item, index) =>
            prisma.$executeRaw`UPDATE "Product" SET "embedding" = ${toVector(vectors[index])}::halfvec WHERE "id" = ${item.id}`,
        ),
      );
    }
  },

  // Admin ke save ke baad peeche-peeche embedding banao; fail ho to bas log (script baad me bana degi).
  syncInBackground(ids: string[]) {
    this.syncProducts(ids).catch((error) => logger.error("Embedding sync failed", { error, count: ids.length }));
  },

  // Meaning se milte chalu products ki ids, sabse paas wale pehle.
  async searchIds(text: string, filters: SearchFilters, limit: number): Promise<string[]> {
    if (!geminiReady) return [];
    const vector = await queryVector(text);

    const where = [
      ...productFilterSql(filters),
      Prisma.sql`p."embedding" IS NOT NULL`,
      Prisma.sql`(p."embedding" <=> ${vector}::halfvec) < ${MAX_DISTANCE}`,
    ];

    const [, rows] = await prisma.$transaction([
      prisma.$executeRaw`SET LOCAL hnsw.iterative_scan = strict_order`,
      prisma.$queryRaw<{ id: string }[]>`
        SELECT p."id" FROM "Product" p
        WHERE ${Prisma.join(where, " AND ")}
        ORDER BY p."embedding" <=> ${vector}::halfvec
        LIMIT ${limit}`,
    ]);
    return rows.map((row) => row.id);
  },
};
