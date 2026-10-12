import { prisma } from "../config/db";
import { clearCache, getOrSetCache } from "../config/redis";
import { AppError } from "../utils/appError";
import { ACTIVE_CATEGORY, CARD_SELECT, productCard } from "../utils/price";

export const productService = {
  async getBySlug(slug: string) {
    const product = await getOrSetCache(`product:${slug}`, async () => {
      const found = await prisma.product.findFirst({
        where: { slug, isActive: true, category: ACTIVE_CATEGORY },
        select: {
          ...CARD_SELECT,
          description: true,
          specs: true,
          category: {
            select: { id: true, name: true, slug: true, parent: { select: { id: true, name: true, slug: true } } },
          },
          brand: { select: { id: true, name: true, slug: true, logo: true, isActive: true } },
        },
      });
      if (!found) return null;

      const { description, images, colors, sizes, specs, category, brand } = found;
      return {
        ...productCard(found),
        description,
        images,
        colors,
        sizes,
        specs,
        category,
        brand: brand?.isActive ? { id: brand.id, name: brand.name, slug: brand.slug, logo: brand.logo } : null,
      };
    });

    if (!product) throw new AppError("Product not found", 404);
    return product;
  },

  async getRelated(slug: string) {
    const related = await getOrSetCache(`related:${slug}`, async () => {
      const product = await prisma.product.findFirst({
        where: { slug, isActive: true, category: ACTIVE_CATEGORY },
        select: { id: true, categoryId: true },
      });
      if (!product) return null;

      const products = await prisma.product.findMany({
        where: { id: { not: product.id }, categoryId: product.categoryId, isActive: true, category: ACTIVE_CATEGORY },
        select: CARD_SELECT,
        orderBy: { createdAt: "desc" },
        take: 8,
      });
      return products.map(productCard);
    });

    if (!related) throw new AppError("Product not found", 404);
    return related;
  },

  async expireOffers() {
    const changed = await prisma.$executeRaw`
      UPDATE "Product" SET "discountPercent" = 0, "sellPaise" = "pricePaise", "offerEndsAt" = NULL
      WHERE "discountPercent" > 0 AND "offerEndsAt" <= NOW()`;
    if (changed > 0) await clearCache();
  },
};
