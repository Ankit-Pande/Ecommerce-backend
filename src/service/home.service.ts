import { prisma } from "../config/db";
import { CACHE_SECONDS, remember } from "../config/cache";
import { ACTIVE_CATEGORY, productCard } from "../utils/price";

const CARD_SELECT = {
  id: true,
  name: true,
  slug: true,
  images: true,
  pricePaise: true,
  discountPercent: true,
  offerEndsAt: true,
  stock: true,
  ratingSum: true,
  ratingCount: true,
} as const;

const SECTION_SIZE = 10;

// Home page ka saara data ek API me: banner, category, brand, trending, featured,
// naye products aur offers. Har visitor ko same, isliye 5 min cache.
export const homeService = {
  async getHome() {
    return remember("home", CACHE_SECONDS, async () => {
      const liveProduct = { isActive: true, category: ACTIVE_CATEGORY };
      const [banners, categories, brands, trending, featured, latest, offers] = await Promise.all([
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
          take: SECTION_SIZE,
        }),
        // "Shop by brand" — sirf wo brand jinke paas dikhne wala product hai.
        prisma.brand.findMany({
          where: { isActive: true, products: { some: liveProduct } },
          select: { id: true, name: true, slug: true, logo: true },
          orderBy: { name: "asc" },
          take: 12,
        }),
        prisma.product.findMany({
          where: { ...liveProduct, isTrending: true },
          select: CARD_SELECT,
          orderBy: { updatedAt: "desc" },
          take: SECTION_SIZE,
        }),
        prisma.product.findMany({
          where: { ...liveProduct, isFeatured: true },
          select: CARD_SELECT,
          orderBy: { updatedAt: "desc" },
          take: SECTION_SIZE,
        }),
        prisma.product.findMany({
          where: liveProduct,
          select: CARD_SELECT,
          orderBy: { createdAt: "desc" },
          take: SECTION_SIZE,
        }),
        // Offers = chalu discount wale products.
        prisma.product.findMany({
          where: {
            ...liveProduct,
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
        brands,
        trendingProducts: trending.map(productCard),
        featuredProducts: featured.map(productCard),
        latestProducts: latest.map(productCard),
        offers: offers.map(productCard),
      };
    });
  },
};
