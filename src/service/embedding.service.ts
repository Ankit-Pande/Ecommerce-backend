import { prisma } from "../config/db";
import { embedTexts, geminiReady } from "../integration/gemini";

const BATCH_SIZE = 100;

async function embedBatch(rows: { id: string; version: string }[]) {
  const products = await prisma.product.findMany({
    where: { id: { in: rows.map((row) => row.id) } },
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

  const texts = products.map((p) =>
    [
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
  );
  const vectors = await embedTexts(texts, "RETRIEVAL_DOCUMENT");
  const versions = products.map((p) => rows.find((row) => row.id === p.id)!.version);

  return prisma.$executeRaw`
    UPDATE "Product" p SET "embedding" = v.vector::halfvec
    FROM unnest(
      ${products.map((p) => p.id)}::text[],
      ${vectors.map((values) => `[${values.join(",")}]`)}::text[],
      ${versions}::text[]
    ) AS v(id, vector, version)
    WHERE p."id" = v.id AND p."updatedAt"::text = v.version`;
}

export const embeddingService = {
  async fillMissing() {
    if (!geminiReady) return;
    for (;;) {
      const rows = await prisma.$queryRaw<{ id: string; version: string }[]>`
        SELECT "id", "updatedAt"::text AS version FROM "Product"
        WHERE "embedding" IS NULL AND "isActive" LIMIT ${BATCH_SIZE}`;
      if (rows.length === 0) return;
      const saved = await embedBatch(rows);
      if (saved === 0) return;
    }
  },
};
