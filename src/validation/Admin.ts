import { z } from "zod"

const UUID = z.string().uuid("Invalid ID")

// Create Category
export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(60),
    slug: z.string().trim().min(2).max(60).toLowerCase(),
    parentId: UUID.optional(),
  }),
})

// Create Product
export const createProductSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(120),
    slug: z.string().trim().min(2),
    description: z.string().trim().min(5).max(2000),
    price: z.coerce.number().positive(),
    stock: z.coerce.number().int().min(0).default(0),
    imageUrl: z.string().trim().url(),
    categoryId: UUID,
  }),
})

// Update Stock
export const updateStockSchema = z.object({
  params: z.object({
    id: UUID,
  }),
  body: z.object({
    stock: z.coerce.number().int().min(0),
  }),
})

// Common ID param
export const idSchema = z.object({
  params: z.object({
    id: UUID,
  }),
})

// Product Offers
export const productOfferSchema = z.object({
  params: z.object({
    id: UUID,
  }),
  body: z.object({
    isTrending: z.boolean().optional(),
    discountPrice: z.coerce.number().positive().optional().nullable(),
  }),
})

// Banner
export const bannerSchema = z.object({
  body: z.object({
    imageUrl: z.string().url(),
    type: z.enum(["CAROUSEL", "FESTIVAL_SALE"]).default("CAROUSEL"),
    link: z.string().trim().optional(),
    isActive: z.boolean().default(true),
  }),
})

// Product List (Admin)
export const getProductsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  }),
})