import { prisma } from "../config/db";
import { embedText, geminiEnabled } from "../integration/gemini";
import { logger } from "../config/winston";

// Product ka embedding — admin save/update pe background me banta hai.
// Fail ho to sirf log: product full-text search me milta rahega (plan ke mutabik).

// Embedding ke liye product ka poora context ek text me (name+brand+category+color+desc).
async function buildProductText(productId: string): Promise<string | null> {
  const p = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      name: true,
      description: true,
      color: true,
      brand: { select: { name: true } },
      category: { select: { name: true } },
    },
  });
  if (!p) return null;
  return [p.name, p.brand?.name, p.category?.name, p.color, p.description]
    .filter(Boolean)
    .join(". ");
}

export const embeddingService = {
  // Ek product ka embedding banao/refresh karo aur usi row ke vector column me save.
  async syncProduct(productId: string): Promise<void> {
    if (!geminiEnabled()) return;
    const text = await buildProductText(productId);
    if (!text) return;

    const vec = await embedText(text);
    if (!vec) return; // fail -> log gemini.ts me ho chuka, full-text chalta rahega

    // pgvector literal: '[0.1,0.2,...]' — raw SQL se save (Prisma vector native nahi).
    await prisma.$executeRaw`
      UPDATE "Product" SET "embedding" = ${`[${vec.join(",")}]`}::vector
      WHERE id = ${productId}
    `;
  },

  // Background sync — response ko block nahi karta, error sirf log hota hai.
  syncInBackground(productIds: string[]): void {
    if (!geminiEnabled() || productIds.length === 0) return;
    (async () => {
      // Ek-ek karke (free tier rate limit ka khayal).
      for (const id of productIds) {
        await this.syncProduct(id);
      }
    })().catch((err) => logger.warn("Embedding background sync failed", { err }));
  },
};
