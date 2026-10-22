import { prisma } from "../config/db";
import { getOrSetCache } from "../config/redis";
import { ACTIVE_CATEGORY, CARD_SELECT, productCard } from "../utils/price";

const SECTION_SIZE = 10;

export const homeService = {
  // Banners, categories and the trending, featured, newest and offer rows (cached).
  async getHome() {
    return getOrSetCache("home", async () => {
      const visible = { isActive: true, category: ACTIVE_CATEGORY };
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
          where: { ...visible, isTrending: true },
          select: CARD_SELECT,
          orderBy: { updatedAt: "desc" },
          take: SECTION_SIZE,
        }),
        prisma.product.findMany({
          where: { ...visible, isFeatured: true },
          select: CARD_SELECT,
          orderBy: { updatedAt: "desc" },
          take: SECTION_SIZE,
        }),
        prisma.product.findMany({
          where: visible,
          select: CARD_SELECT,
          orderBy: { createdAt: "desc" },
          take: SECTION_SIZE,
        }),
        prisma.product.findMany({
          where: {
            ...visible,
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
