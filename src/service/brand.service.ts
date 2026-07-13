import { prisma } from "../config/db";
import { cache } from "../utils/cache";

// Active brands list (filter dropdown ke liye). Redis cache 1 ghanta.
export const brandService = {
  async getAll() {
    const cacheKey = "brands:all";
    const cached = await cache.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const brands = await prisma.brand.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true, logo: true },
      orderBy: { name: "asc" },
    });

    await cache.set(cacheKey, JSON.stringify(brands), 3600);
    return brands;
  },
};
