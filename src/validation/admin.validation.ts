import { z } from "zod";

const slug = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug lowercase, dash-separated ho");

// Multipart form me boolean string ("true"/"false") aata hai — sahi parse karo
// (z.coerce.boolean "false" ko true bana deta hai, isliye preprocess).
const boolParam = z.preprocess(
  (v) => (v === "true" ? true : v === "false" ? false : v),
  z.boolean()
);

// ---------- Product ----------
export const createProductSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(150),
    slug,
    description: z.string().trim().min(5).max(5000),
    // Rupee me aata hai form se -> service paise me convert karega.
    price: z.coerce.number().positive().max(10000000),
    discountPercent: z.coerce.number().int().min(0).max(90).default(0),
    stock: z.coerce.number().int().min(0).default(0),
    categoryId: z.string().uuid(),
    brandId: z.string().uuid().optional(),
    color: z.string().trim().min(1).max(30).optional(),
    isTrending: boolParam.optional(),
    // Images multipart se file ke roop me aati hain (controller handle karta hai).
  }),
});

export const updateProductSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    name: z.string().trim().min(2).max(150).optional(),
    slug: slug.optional(),
    description: z.string().trim().min(5).max(5000).optional(),
    price: z.coerce.number().positive().max(10000000).optional(),
    discountPercent: z.coerce.number().int().min(0).max(90).optional(),
    stock: z.coerce.number().int().min(0).optional(),
    categoryId: z.string().uuid().optional(),
    // null bhejo to product se brand hat jaata hai.
    brandId: z.string().uuid().nullable().optional(),
    color: z.string().trim().min(1).max(30).optional(),
    isTrending: boolParam.optional(),
    isActive: boolParam.optional(),
  }),
});

// Bulk create — max 50 products ek saath. Images yahan Cloudinary URLs hoti hain
// (pehle POST /admin/uploads se upload karke URLs le lo — admin panel yahi karega).
export const bulkCreateProductSchema = z.object({
  body: z.object({
    products: z
      .array(
        z.object({
          name: z.string().trim().min(2).max(150),
          slug,
          description: z.string().trim().min(5).max(5000),
          price: z.coerce.number().positive().max(10000000),
          discountPercent: z.coerce.number().int().min(0).max(90).default(0),
          stock: z.coerce.number().int().min(0).default(0),
          categoryId: z.string().uuid(),
          brandId: z.string().uuid().optional(),
          color: z.string().trim().min(1).max(30).optional(),
          isTrending: boolParam.optional(),
          images: z.array(z.string().url()).max(6).default([]),
        })
      )
      .min(1)
      .max(50),
  }),
});

export const adminListProductSchema = z.object({
  query: z.object({
    q: z.string().trim().max(100).optional(),
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }),
});

export const idParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

// ---------- Category ----------
export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(80),
    slug,
    parentId: z.string().uuid().optional(),
  }),
});

export const updateCategorySchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    name: z.string().trim().min(2).max(80).optional(),
    slug: slug.optional(),
    parentId: z.string().uuid().nullable().optional(),
    isActive: boolParam.optional(),
  }),
});

// ---------- Brand ----------
export const createBrandSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(80),
    slug,
  }),
});

export const updateBrandSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    name: z.string().trim().min(2).max(80).optional(),
    slug: slug.optional(),
    isActive: boolParam.optional(),
  }),
});

// ---------- Banner ----------
export const createBannerSchema = z.object({
  body: z.object({
    link: z.string().url().optional(),
    position: z.coerce.number().int().min(0).default(0),
  }),
});

export const updateBannerSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    link: z.string().url().nullable().optional(),
    position: z.coerce.number().int().min(0).optional(),
    isActive: boolParam.optional(),
  }),
});

// ---------- Order management ----------
export const updateOrderStatusSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    status: z.enum(["CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"]),
  }),
});

export const adminListOrderSchema = z.object({
  query: z.object({
    status: z
      .enum(["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"])
      .optional(),
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }),
});

// ---------- User management ----------
export const adminListUserSchema = z.object({
  query: z.object({
    q: z.string().trim().max(20).optional(), // phone se dhundo
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }),
});

export const blockUserSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    isBlocked: z.boolean(),
  }),
});

// Role toggle — sirf USER <-> ADMIN (SUPER_ADMIN yahan se set nahi hota).
export const setUserRoleSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    role: z.enum(["USER", "ADMIN"]),
  }),
});
