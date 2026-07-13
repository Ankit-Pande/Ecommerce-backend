import { prisma } from "../config/db";
import { cache } from "../utils/cache";

// Category tree (top categories + unke children). Home/nav me dikhta hai, har visitor
// ko same — isliye Redis cache 1 ghanta.
export const categoryService = {
  async getTree() {
    const cacheKey = "categories:tree";
    const cached = await cache.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const categories = await prisma.category.findMany({
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
    });

    await cache.set(cacheKey, JSON.stringify(categories), 3600);
    return categories;
  },
};
