import { prisma } from "../config/db"
import { AppError } from "../utils/AppError"
import { Prisma } from "@prisma/client"
import { productService } from "./ProductService"

export const adminService = {

  // 1️⃣ Create Category (Slug + Subcategory support)
  async createCategory(data: {
    name: string
    slug: string
    parentId?: string
  }) {

    const existing = await prisma.category.findUnique({
      where: { slug: data.slug },
    })

    if (existing) {
      throw new AppError("Category with this slug already exists", 400)
    }

    if (data.parentId) {
      const parent = await prisma.category.findUnique({
        where: { id: data.parentId },
      })

      if (!parent) {
        throw new AppError("Parent category not found", 404)
      }
    }

    return prisma.category.create({ data })
  },

  // 2️⃣ Create Product
  async createProduct(data: Prisma.ProductUncheckedCreateInput) {
    return prisma.product.create({ data })
  },

  // 3️⃣ Get Products (Pagination)
  async getProducts(page: number, limit: number) {

    const skip = (page - 1) * limit

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        skip,
        take: limit,
        include: { category: true },
      }),
      prisma.product.count(),
    ])

    return {
      products,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    }
  },

  // 4️⃣ Update Stock
  async updateStock(id: string, stock: number) {

    const product = await prisma.product.update({
      where: { id },
      data: { stock },
    })

    await productService.clearProductCache(product.slug)

    return product
  },

  // 5️⃣ Hide Product
  async hideProduct(id: string) {

    const product = await prisma.product.update({
      where: { id },
      data: { isHidden: true },
    })

    await productService.clearProductCache(product.slug)

    return product
  },

  // 6️⃣ Create Banner (Full support)
  async createBanner(data: {
    imageUrl: string
    type: string
    link?: string
    isActive: boolean
  }) {
    return prisma.banner.create({ data })
  },

  // 7️⃣ Delete Banner
  async deleteBanner(id: string) {
    return prisma.banner.delete({ where: { id } })
  },

  // 8️⃣ Update Offers (Trending + Discount)
  async updateProductOffers(
    id: string,
    data: {
      isTrending?: boolean
      discountPrice?: number | null
    }
  ) {

    const product = await prisma.product.findUnique({
      where: { id },
    })

    if (!product) {
      throw new AppError("Product not found", 404)
    }

    if (
      data.discountPrice !== undefined &&
      data.discountPrice !== null &&
      data.discountPrice >= Number(product.price)
    ) {
      throw new AppError(
        "Discount price must be less than original price",
        400
      )
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data,
    })

    await productService.clearProductCache(product.slug)

    return updatedProduct
  },
}