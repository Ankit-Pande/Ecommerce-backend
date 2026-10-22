import { prisma } from "../config/db";
import { clearCache, getOrSetCache } from "../config/redis";
import { AppError } from "../utils/appError";
import { ACTIVE_CATEGORY, CARD_SELECT, productCard } from "../utils/price";

export const productService = {
  // The product page: card fields, description, specs, category, brand and the count of each star rating (cached).
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

      const stars = await prisma.review.groupBy({
        by: ["rating"],
        where: { productId: found.id },
        _count: { _all: true },
      });
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
        ratingBars: [5, 4, 3, 2, 1].map((rating) => ({
          stars: rating,
          count: stars.find((row) => row.rating === rating)?._count._all ?? 0,
        })),
      };
    });

    if (!product) throw new AppError("Product not found", 404);
    return product;
  },

  // Up to 8 newest products from the same category (cached).
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

  // Ends offers whose end date has passed (runs every minute) and clears the cache when something changed.
  async expireOffers() {
    const changed = await prisma.$executeRaw`
      UPDATE "Product" SET "discountPercent" = 0, "sellPaise" = "pricePaise", "offerEndsAt" = NULL
      WHERE "discountPercent" > 0 AND "offerEndsAt" <= NOW()`;
    if (changed > 0) await clearCache();
  },
};
