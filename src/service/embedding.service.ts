import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/db";
import { redis } from "../config/redis";
import { logger } from "../config/winston";
import { embedTexts, geminiReady } from "../integration/gemini";

const BATCH_SIZE = 100;
const QUERY_VECTOR_SECONDS = 7 * 24 * 3600;
const MAX_DISTANCE = 0.45;

export type SearchFilters = {
  brandIds?: string[];
  categoryIds?: string[];
  categoryNames?: string[];
  colors?: string[];
  gender?: string[];
  ageGroup?: string[];
  minPaise?: number;
  maxPaise?: number;
  discount?: boolean;
  trending?: boolean;
  featured?: boolean;
  size?: string;
};

// AI search ke filter (SQL, product "p"): chalu product, brand, category (ya naam me category, jaise "Boys T-Shirt"), rang, kiske liye (phone jaise bina gender wale bhi), price, offer, trending, featured, size.
export function productFilterSql(filters: SearchFilters): Prisma.Sql[] {
  const where: Prisma.Sql[] = [
    Prisma.sql`p."isActive" = true`,
    Prisma.sql`EXISTS (SELECT 1 FROM "Category" c LEFT JOIN "Category" pc ON pc."id" = c."parentId"
      WHERE c."id" = p."categoryId" AND c."isActive" = true AND (pc."id" IS NULL OR pc."isActive" = true))`,
  ];
  if (filters.brandIds) where.push(Prisma.sql`p."brandId" IN (${Prisma.join(filters.brandIds)})`);
  if (filters.categoryIds) {
    const byName = (filters.categoryNames ?? []).map(
      (name) => Prisma.sql`p."searchText" @@ plainto_tsquery('english', ${name})`,
    );
    const inCategory = Prisma.sql`p."categoryId" IN (${Prisma.join(filters.categoryIds)})`;
    where.push(Prisma.sql`(${Prisma.join([inCategory, ...byName], " OR ")})`);
  }
  if (filters.colors) where.push(Prisma.sql`p."colors" && ARRAY[${Prisma.join(filters.colors)}]::text[]`);
  if (filters.gender) where.push(Prisma.sql`(p."gender" IN (${Prisma.join(filters.gender)}) OR p."gender" IS NULL)`);
  if (filters.ageGroup) {
    where.push(Prisma.sql`(p."ageGroup" IN (${Prisma.join(filters.ageGroup)}) OR p."ageGroup" IS NULL)`);
  }
  if (filters.minPaise !== undefined) where.push(Prisma.sql`p."sellPaise" >= ${filters.minPaise}`);
  if (filters.maxPaise !== undefined) where.push(Prisma.sql`p."sellPaise" <= ${filters.maxPaise}`);
  if (filters.discount) where.push(Prisma.sql`p."discountPercent" > 0`);
  if (filters.trending) where.push(Prisma.sql`p."isTrending" = true`);
  if (filters.featured) where.push(Prisma.sql`p."isFeatured" = true`);
  if (filters.size) where.push(Prisma.sql`${filters.size} ILIKE ANY(p."sizes")`);
  return where;
}

const toVector = (values: number[]) => `[${values.join(",")}]`;

// Product ka text jisse meaning banta hai: naam, brand, category, kiske liye, colour, specs, description.
async function productTexts(ids: string[]) {
  const rows = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      description: true,
      colors: true,
      sizes: true,
      gender: true,
      ageGroup: true,
      specs: true,
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
      p.colors.join(", "),
      p.sizes.length > 0 && `sizes ${p.sizes.join(", ")}`,
      p.specs &&
        Object.entries(p.specs)
          .map(([key, value]) => `${key} ${value}`)
          .join(", "),
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
      // Poora batch ek hi query me save (remote DB par 100 alag query bahut dheere chalti hain).
      await prisma.$executeRaw`
        UPDATE "Product" p SET "embedding" = v.vector::halfvec
        FROM unnest(${items.map((item) => item.id)}::text[], ${vectors.map(toVector)}::text[]) AS v(id, vector)
        WHERE p."id" = v.id`;
    }
  },

  // Bina embedding wale chalu products (100 tak) ka embedding banao; kitne bane wo batao.
  async fillMissing(): Promise<number> {
    if (!geminiReady) return 0;
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Product" WHERE "embedding" IS NULL AND "isActive" = true LIMIT ${BATCH_SIZE}`;
    await this.syncProducts(rows.map((row) => row.id));
    return rows.length;
  },

  // Admin ke save ke baad peeche-peeche embedding banao; fail ho to purana embedding hatao, har ghante wala kaam naya bana dega.
  syncInBackground(ids: string[]) {
    this.syncProducts(ids).catch(async (error) => {
      logger.error("Embedding sync failed", { error, count: ids.length });
      await prisma.$executeRaw`UPDATE "Product" SET "embedding" = NULL WHERE "id" IN (${Prisma.join(ids)})`.catch(
        () => null,
      );
    });
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
