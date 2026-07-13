import { z } from "zod";

// Listing/search query. Cursor pagination (offset NAHI — 50k+ products pe offset slow).
// Filters optional, sab ek hi endpoint handle karta hai.
export const listProductSchema = z.object({
  query: z.object({
    // Full-text search term (Postgres tsvector). Khaali = sab products.
    q: z.string().trim().min(1).max(100).optional(),

    categoryId: z.string().uuid().optional(),
    brandId: z.string().uuid().optional(),
    color: z.string().trim().min(1).max(30).optional(),

    // Price filter (rupee me aata hai, service paise me convert karta hai).
    minPrice: z.coerce.number().int().nonnegative().optional(),
    maxPrice: z.coerce.number().int().nonnegative().optional(),

    sort: z.enum(["newest", "price_asc", "price_desc"]).default("newest"),

    // Cursor: normal list me last item ka id, search me "rank:id" format —
    // isliye uuid-strict nahi, opaque string hai (frontend bas wapas bhejta hai).
    cursor: z.string().trim().min(1).max(100).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }),
});

export const productSlugSchema = z.object({
  params: z.object({
    slug: z.string().trim().min(1),
  }),
});

// Facets — current category/search me available brands + colors.
export const productFacetsSchema = z.object({
  query: z.object({
    categoryId: z.string().uuid().optional(),
    q: z.string().trim().min(1).max(100).optional(),
  }),
});
