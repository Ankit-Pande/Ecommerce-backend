import { z } from "zod"


export const productQuerySchema = z.object({
  query: z
    .object({
      page: z.coerce.number().int().min(1).default(1),

      limit: z.coerce.number().int().min(1).max(50).default(10),

      search: z.string().trim().optional(),

      category: z.string().uuid().optional(),

      minPrice: z.coerce.number().min(0).optional(),

      maxPrice: z.coerce.number().min(0).optional(),

      sortBy: z
        .enum(["price", "createdAt", "ratings"])
        .default("createdAt"),

      sortOrder: z.enum(["asc", "desc"]).default("desc"),
    })
    .refine(
      (data) => {
        // Agar dono price aaye hain to max >= min hona chahiye
        if (
          data.minPrice !== undefined &&
          data.maxPrice !== undefined
        ) {
          return data.maxPrice >= data.minPrice
        }

        return true
      },
      {
        message: "maxPrice cannot be less than minPrice",
        path: ["maxPrice"],
      }
    ),
})

// ----------------------------
// Slug Param Schema
// ----------------------------

export const slugSchema = z.object({
  params: z.object({
    slug: z.string().trim().min(1, "Slug is required"),
  }),
})

// ----------------------------
// Type Export (For Service)
// ----------------------------

export type ProductQuery =
  z.infer<typeof productQuerySchema>["query"]