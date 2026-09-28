import { prisma } from "../config/db";
import { AppError } from "../utils/appError";
import { bumpStorefrontCache, CACHE_SECONDS, remember } from "../config/cache";
import { ACTIVE_CATEGORY, CARD_SELECT, productCard } from "../utils/price";

const VIEW_KEEP_DAYS = 90;

export const productService = {
  // Product detail page (5 min cache). Exact stock nahi, sirf status.
  async getBySlug(slug: string) {
    const product = await remember(`product:${slug}`, CACHE_SECONDS, async () => {
      const row = await prisma.product.findFirst({
        where: { slug, isActive: true, category: ACTIVE_CATEGORY },
        select: {
          ...CARD_SELECT,
          description: true,
          color: true,
          isTrending: true,
          isFeatured: true,
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
      // throw yahan nahi — null cache me jaata hai, isliye galat slug dobara DB tak nahi pahunchta.
      if (!row) return null;

      const { description, images, color, isTrending, isFeatured, category, brand } = row;
      return {
        ...productCard(row),
        description,
        images,
        color,
        isTrending,
        isFeatured,
        // ACTIVE_CATEGORY filter pehle hi pakka karta hai ki category aur parent dono chalu hain.
        category,
        brand: brand?.isActive ? { id: brand.id, name: brand.name, slug: brand.slug, logo: brand.logo } : null,
      };
    });

    if (!product) throw new AppError("Product not found", 404);
    return product;
  },

  // Guest ka recently-viewed: kai slug ka current card ek call me, maange hue kram me.
  async getManyBySlugs(requested: string[]) {
    const slugs = [...new Set(requested)];
    // Sorted key: "a,b" aur "b,a" ek hi cache entry.
    const cards = await remember(`products:${[...slugs].sort().join(",")}`, CACHE_SECONDS, async () => {
      const rows = await prisma.product.findMany({
        where: { slug: { in: slugs }, isActive: true, category: ACTIVE_CATEGORY },
        select: CARD_SELECT,
      });
      return rows.map(productCard);
    });
    // Frontend ne jis kram me slug bheje, usi kram me wapas.
    const bySlug = new Map(cards.map((card) => [card.slug, card]));
    return slugs.map((slug) => bySlug.get(slug)).filter((card) => card !== undefined);
  },

  // Usi category ke 8 aur products.
  async getRelated(slug: string) {
    const related = await remember(`related:${slug}`, CACHE_SECONDS, async () => {
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

  // Login user ne product dekha (product page se, bina rukawat ke).
  async recordView(userId: string, productId: string) {
    await prisma.productView.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId },
      // @updatedAt par bharosa nahi — khaali update par wo chalega ya nahi, ye tay nahi.
      update: { viewedAt: new Date() },
    });
  },

  async getRecentlyViewed(userId: string) {
    const rows = await prisma.productView.findMany({
      where: { userId, product: { isActive: true, category: ACTIVE_CATEGORY } },
      orderBy: { viewedAt: "desc" },
      take: 5,
      select: { product: { select: CARD_SELECT } },
    });
    return rows.map(({ product }) => productCard(product));
  },

  // Roz (server.ts): 90 din purane view hata do — ye table kabhi apne aap saaf nahi hoti.
  async deleteOldViews() {
    const cutoff = new Date(Date.now() - VIEW_KEEP_DAYS * 24 * 60 * 60 * 1000);
    await prisma.productView.deleteMany({ where: { viewedAt: { lt: cutoff } } });
  },

  // Har minute (server.ts): khatam hue offer ka discount 0 aur sellPaise = MRP,
  // taaki catalog ka price filter/sort sahi rahe. Purani date bhi hatao — warna admin
  // agla discount bina nayi date ke lagaye to wo beeti date ki wajah se turant mar jaata.
  async expireOffers() {
    const changed = await prisma.$executeRaw`
      UPDATE "Product" SET "discountPercent" = 0, "sellPaise" = "pricePaise", "offerEndsAt" = NULL
      WHERE "discountPercent" > 0 AND "offerEndsAt" <= NOW()`;
    if (changed > 0) await bumpStorefrontCache();
  },
};
