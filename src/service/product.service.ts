import { prisma } from "../config/db";
import { AppError } from "../utils/appError";
import { clearStoreCache, CACHE_SECONDS, getOrSetCache } from "../config/cache";
import { ACTIVE_CATEGORY, CARD_SELECT, productCard } from "../utils/price";

export const productService = {
  // Product detail page (5 min cache).
  async getBySlug(slug: string) {
    const product = await getOrSetCache(`product:${slug}`, CACHE_SECONDS, async () => {
      const row = await prisma.product.findFirst({
        where: { slug, isActive: true, category: ACTIVE_CATEGORY },
        select: {
          ...CARD_SELECT,
          description: true,
          color: true,
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              parent: { select: { id: true, name: true, slug: true } },
            },
          },
          brand: { select: { id: true, name: true, slug: true, logo: true, isActive: true } },
        },
      });
      // null bhi cache hota hai, taaki galat slug baar-baar DB tak na jaaye.
      if (!row) return null;

      const { description, images, color, category, brand } = row;
      return {
        ...productCard(row),
        description,
        images,
        color,
        category,
        brand: brand?.isActive ? { id: brand.id, name: brand.name, slug: brand.slug, logo: brand.logo } : null,
      };
    });

    if (!product) throw new AppError("Product not found", 404);
    return product;
  },

  // Kai slug ke product ek saath, usi kram me (guest ka recently viewed).
  async getManyBySlugs(requested: string[]) {
    const slugs = [...new Set(requested)];
    const cards = await getOrSetCache(`products:${[...slugs].sort().join(",")}`, CACHE_SECONDS, async () => {
      const rows = await prisma.product.findMany({
        where: { slug: { in: slugs }, isActive: true, category: ACTIVE_CATEGORY },
        select: CARD_SELECT,
      });
      return rows.map(productCard);
    });
    const bySlug = new Map(cards.map((card) => [card.slug, card]));
    return slugs.map((slug) => bySlug.get(slug)).filter((card) => card !== undefined);
  },

  // Usi category ke 8 aur products.
  async getRelated(slug: string) {
    const related = await getOrSetCache(`related:${slug}`, CACHE_SECONDS, async () => {
      const row = await prisma.product.findFirst({
        where: { slug, isActive: true, category: ACTIVE_CATEGORY },
        select: { id: true, categoryId: true },
      });
      if (!row) return null;

      const related = await prisma.product.findMany({
        where: {
          id: { not: row.id },
          categoryId: row.categoryId,
          isActive: true,
          category: ACTIVE_CATEGORY,
        },
        select: CARD_SELECT,
        orderBy: { createdAt: "desc" },
        take: 8,
      });
      return related.map(productCard);
    });

    if (!related) throw new AppError("Product not found", 404);
    return related;
  },

  // Khatam offer hatao: discount 0, price = MRP, date bhi saaf (har minute).
  async expireOffers() {
    const changed = await prisma.$executeRaw`
      UPDATE "Product" SET "discountPercent" = 0, "sellPaise" = "pricePaise", "offerEndsAt" = NULL
      WHERE "discountPercent" > 0 AND "offerEndsAt" <= NOW()`;
    if (changed > 0) await clearStoreCache();
  },
};
