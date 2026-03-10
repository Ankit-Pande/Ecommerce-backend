import { prisma } from '../config/db'
import { redis } from '../config/redis'
import { Prisma } from '@prisma/client'
import { ProductQuery } from '../validation/Product'
import { logger } from '../config/winston'

const CACHE_TTL = 3600 

export const productService = {
  async getAllProducts(query: ProductQuery) {
    const { page, limit, search, category, minPrice, maxPrice, sortBy, sortOrder } = query

    const where: Prisma.ProductWhereInput = { isHidden: false }

    if (search) {
      where.name = { contains: search, mode: 'insensitive' }
    }
    if (category) {
      where.categoryId = category
    }
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {}
      if (minPrice !== undefined) where.price.gte = minPrice
      if (maxPrice !== undefined) where.price.lte = maxPrice
    }

    const skip = (page - 1) * limit

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: { category: { select: { name: true } } }
      }),
      prisma.product.count({ where })
    ])

    return {
      products,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    }
  },

  async getProductBySlug(slug: string) {
    const cacheKey = `product:slug:${slug}`

    try {
      const cachedData = await redis.get(cacheKey)
      if (cachedData) return JSON.parse(cachedData)
    } catch (error) {
      logger.error(`Redis Get Error for ${cacheKey}`, { error })
    }

    const product = await prisma.product.findFirst({
      where: { slug, isHidden: false },
      include: { category: true }
    })

    if (product) {
      try {
        await redis.set(cacheKey, JSON.stringify(product), 'EX', CACHE_TTL)
      } catch (error) {
        logger.error(`Redis Set Error for ${cacheKey}`, { error })
      }
    }

    return product
  },

  async clearProductCache(slug: string) {
    try {
      await redis.del(`product:slug:${slug}`)
    } catch (error) {
      logger.error(`Redis Del Error for slug ${slug}`, { error })
    }
  }
}