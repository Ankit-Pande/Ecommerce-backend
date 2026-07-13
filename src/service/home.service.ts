import { prisma } from "../config/db";
import { cache } from "../utils/cache";

// Home page ka saara data EK API me (banner + category + trending + recent + discount).
// Frontend ko 5 call ki jagah 1 call. Sab parallel fetch + poora home ek Redis key me
// cache (10 min) — har visitor ko same, super fast.

// Listing card ka chhota shape (sirf jo home pe chahiye).
const CARD_SELECT = {
  id: true,
  name: true,
  slug: true,
  pricePaise: true,
  discountPercent: true,
  images: true,
  stock: true,
};

export const homeService = {
  async getHome() {
    const cacheKey = "home:data";
    const cached = await cache.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // Sab queries ek saath (parallel) — total time sabse slow query jitna hi.
    const [banners, categories, trending, recent, discounted] =
      await Promise.all([
        // Carousel banners (position order).
        prisma.banner.findMany({
          where: { isActive: true },
          select: { id: true, image: true, link: true },
          orderBy: { position: "asc" },
        }),
        // Category + subcategory tree (nav/home).
        prisma.category.findMany({
          where: { parentId: null, isActive: true },
          select: {
            id: true,
            name: true,
            slug: true,
            image: true,
            children: {
              where: { isActive: true },
              select: { id: true, name: true, slug: true },
              orderBy: { name: "asc" },
            },
          },
          orderBy: { name: "asc" },
        }),
        // Trending products.
        prisma.product.findMany({
          where: { isTrending: true, isActive: true },
          select: CARD_SELECT,
          orderBy: { createdAt: "desc" },
          take: 12,
        }),
        // Recently added (naye products).
        prisma.product.findMany({
          where: { isActive: true },
          select: CARD_SELECT,
          orderBy: { createdAt: "desc" },
          take: 12,
        }),
        // Discount/offer products (jin pe discount hai, sabse zyada pehle).
        prisma.product.findMany({
          where: { isActive: true, discountPercent: { gt: 0 } },
          select: CARD_SELECT,
          orderBy: { discountPercent: "desc" },
          take: 12,
        }),
      ]);

    const data = { banners, categories, trending, recent, discounted };
    await cache.set(cacheKey, JSON.stringify(data), 600);
    return data;
  },
};
