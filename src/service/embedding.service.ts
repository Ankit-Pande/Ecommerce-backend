import { prisma } from "../config/db";
import { embedTexts, geminiReady } from "../integration/gemini";

const BATCH_SIZE = 100;
const MAX_BATCHES_PER_RUN = 20;
const MAX_TEXT_LENGTH = 2000;

// Builds the text of each product, gets its vector from Gemini and saves it if the product did not change meanwhile.
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

  const texts = products.map((product) =>
    [
      product.name,
      product.brand?.name,
      product.category.parent?.name,
      product.category.name,
      product.gender,
      product.ageGroup,
      product.colors.join(", "),
      product.sizes.length > 0 && `sizes ${product.sizes.join(", ")}`,
      product.specs &&
        Object.entries(product.specs)
          .map(([key, value]) => `${key} ${value}`)
          .join(", "),
      product.description.slice(0, 500),
    ]
      .filter(Boolean)
      .join(" | ")
      .slice(0, MAX_TEXT_LENGTH),
  );
  const vectors = await embedTexts(texts, "RETRIEVAL_DOCUMENT");
  const versions = products.map((product) => rows.find((row) => row.id === product.id)!.version);

  return prisma.$executeRaw`
    UPDATE "Product" product SET "embedding" = batch.vector::halfvec
    FROM unnest(
      ${products.map((product) => product.id)}::text[],
      ${vectors.map((values) => `[${values.join(",")}]`)}::text[],
      ${versions}::text[]
    ) AS batch(id, vector, version)
    WHERE product."id" = batch.id AND product."updatedAt"::text = batch.version`;
}

export const embeddingService = {
  // Fills missing embeddings of active products, 100 at a time and up to 2,000 per run (runs every minute).
  async fillMissing() {
    if (!geminiReady) return;
    for (let round = 0; round < MAX_BATCHES_PER_RUN; round++) {
      const rows = await prisma.$queryRaw<{ id: string; version: string }[]>`
        SELECT "id", "updatedAt"::text AS version FROM "Product"
        WHERE "embedding" IS NULL AND "isActive" LIMIT ${BATCH_SIZE}`;
      if (rows.length === 0) return;
      const saved = await embedBatch(rows);
      if (saved === 0) return;
    }
  },
};
