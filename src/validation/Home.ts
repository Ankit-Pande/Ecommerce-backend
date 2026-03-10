import { z } from "zod"

export const homePaginationSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  }),
})

export const slugParamSchema = z.object({
  params: z.object({
    slug: z.string().trim().min(1, "Slug is required"),
  }),
})

export const trackViewSchema = z.object({
  body: z.object({
    productId: z.string().uuid("Invalid Product ID"),
  }),
})