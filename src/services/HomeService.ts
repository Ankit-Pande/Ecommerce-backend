import { prisma } from "../config/db"
import { redis } from "../config/redis"

export const homeService = {

  // 1️⃣ Home Page Data
  async getHomeData() {
    const [banners, categories, trending, topOffers] =
      await Promise.all([

        prisma.banner.findMany({
          where: { isActive: true },
        }),

        prisma.category.findMany({
          where: { parentId: null },
          include: { children: true },
        }),

        prisma.product.findMany({
          where: { isTrending: true, isHidden: false },
          take: 10,
        }),

        prisma.product.findMany({
          where: {
            discountPrice: { not: null },
            isHidden: false,
          },
          orderBy: { discountPrice: "asc" },
          take: 10,
        }),
      ])

    return {
      banners,
      categories,
      trending,
      topOffers,
    }
  },

  // 2️⃣ Category Products (Slug + Pagination)
  async getCategoryProducts(
    slug: string,
    page: number,
    limit: number
  ) {
    const skip = (page - 1) * limit

    const category = await prisma.category.findUnique({
      where: { slug },
    })

    if (!category) {
      return null
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where: {
          categoryId: category.id,
          isHidden: false,
        },
        skip,
        take: limit,
      }),

      prisma.product.count({
        where: {
          categoryId: category.id,
          isHidden: false,
        },
      }),
    ])

    return {
      products,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    }
  },

  // 3️⃣ Similar Products
  async getSimilarProducts(
    productId: string,
    categoryId: string
  ) {
    return prisma.product.findMany({
      where: {
        categoryId,
        id: { not: productId },
        isHidden: false,
      },
      take: 8,
    })
  },

  // 4️⃣ Track Recently Viewed
  async trackRecentlyViewed(
    userId: string,
    productId: string
  ) {
    const key = `recently_viewed:${userId}`

    const pipeline = redis.pipeline()

    pipeline.lrem(key, 0, productId)
    pipeline.lpush(key, productId)
    pipeline.ltrim(key, 0, 9)
    pipeline.expire(key, 7 * 24 * 60 * 60)

    await pipeline.exec()
  },

  async getRecentlyViewed(userId: string) {
    const key = `recently_viewed:${userId}`

    const productIds = await redis.lrange(key, 0, 9)

    if (!productIds.length) {
      return []
    }

    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        isHidden: false,
      },
    })

    // Same order maintain karo
    return productIds
      .map((id) => products.find((p) => p.id === id))
      .filter(Boolean)
  },
}