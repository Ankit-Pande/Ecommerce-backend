import { prisma } from "../config/db";
import { AppError } from "../utils/appError";
import { clearStoreCache, CACHE_SECONDS, getOrSetCache } from "../config/cache";
import { ACTIVE_CATEGORY, CARD_SELECT, productCard } from "../utils/price";

export const productService = {
  // Product detail page ka data; galat slug bhi cache hota hai taaki baar-baar DB na jaye (5 minute cache).
  async getBySlug(slug: string) {
    const product = await getOrSetCache(`product:${slug}`, CACHE_SECONDS, async () => {
      const found = await prisma.product.findFirst({
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
      if (!found) return null;

      const { description, images, color, category, brand } = found;
      return {
        ...productCard(found),
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
  async getManyBySlugs(slugList: string[]) {
    const slugs = [...new Set(slugList)];
    const cards = await getOrSetCache(`products:${[...slugs].sort().join(",")}`, CACHE_SECONDS, async () => {
      const rows = await prisma.product.findMany({
        where: { slug: { in: slugs }, isActive: true, category: ACTIVE_CATEGORY },
        select: CARD_SELECT,
      });
      return rows.map(productCard);
    });
    const cardBySlug = new Map(cards.map((card) => [card.slug, card]));
    return slugs.map((slug) => cardBySlug.get(slug)).filter((card) => card !== undefined);
  },

  // Usi category ke 8 aur products.
  async getRelated(slug: string) {
    const related = await getOrSetCache(`related:${slug}`, CACHE_SECONDS, async () => {
      const product = await prisma.product.findFirst({
        where: { slug, isActive: true, category: ACTIVE_CATEGORY },
        select: { id: true, categoryId: true },
      });
      if (!product) return null;

      const sameCategory = await prisma.product.findMany({
        where: {
          id: { not: product.id },
          categoryId: product.categoryId,
          isActive: true,
          category: ACTIVE_CATEGORY,
        },
        select: CARD_SELECT,
        orderBy: { createdAt: "desc" },
        take: 8,
      });
      return sameCategory.map(productCard);
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
