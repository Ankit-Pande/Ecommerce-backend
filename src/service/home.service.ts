import { prisma } from "../config/db";
import { CACHE_SECONDS, getOrSetCache } from "../config/cache";
import { ACTIVE_CATEGORY, CARD_SELECT, productCard } from "../utils/price";

const SECTION_SIZE = 10;

export const homeService = {
  // Home page ka saara data ek baar me: banner, saari category aur 4 product section (5 minute cache).
  async getHome() {
    return getOrSetCache("home", CACHE_SECONDS, async () => {
      const visibleProduct = { isActive: true, category: ACTIVE_CATEGORY };
      const [banners, categories, trending, featured, latest, offers] = await Promise.all([
        prisma.banner.findMany({
          where: { isActive: true },
          select: { id: true, image: true, link: true },
          orderBy: [{ position: "asc" }, { createdAt: "desc" }],
        }),
        prisma.category.findMany({
          where: { parentId: null, isActive: true },
          select: {
            id: true,
            name: true,
            slug: true,
            image: true,
            children: {
              where: { isActive: true },
              select: { id: true, name: true, slug: true, image: true },
              orderBy: { name: "asc" },
            },
          },
          orderBy: { name: "asc" },
        }),
        prisma.product.findMany({
          where: { ...visibleProduct, isTrending: true },
          select: CARD_SELECT,
          orderBy: { updatedAt: "desc" },
          take: SECTION_SIZE,
        }),
        prisma.product.findMany({
          where: { ...visibleProduct, isFeatured: true },
          select: CARD_SELECT,
          orderBy: { updatedAt: "desc" },
          take: SECTION_SIZE,
        }),
        prisma.product.findMany({
          where: visibleProduct,
          select: CARD_SELECT,
          orderBy: { createdAt: "desc" },
          take: SECTION_SIZE,
        }),
        prisma.product.findMany({
          where: {
            ...visibleProduct,
            discountPercent: { gt: 0 },
            OR: [{ offerEndsAt: null }, { offerEndsAt: { gt: new Date() } }],
          },
          select: CARD_SELECT,
          orderBy: [{ discountPercent: "desc" }, { updatedAt: "desc" }],
          take: SECTION_SIZE,
        }),
      ]);

      return {
        banners,
        categories,
        trendingProducts: trending.map(productCard),
        featuredProducts: featured.map(productCard),
        latestProducts: latest.map(productCard),
        offers: offers.map(productCard),
      };
    });
  },
};
