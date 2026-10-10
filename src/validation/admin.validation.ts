import { z } from "zod";
import { AGE_GROUPS, GENDERS, idParams, orderStatus, pageParams, queryBoolean, slug, uuid } from "./common";

const formBoolean = z.preprocess((v) => (v === "true" ? true : v === "false" ? false : v), z.boolean());

// Form me khaali string bhejo = field hatao (null).
const emptyToNull = (v: unknown) => (v === "" ? null : v);

const clearableText = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && !v.trim() ? null : v), z.string().trim().min(1).max(max).nullable());

// Fixed list wale field. Khaali bhejo to field hat jaata hai.
const clearableEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(emptyToNull, z.enum(values).nullable());

// Specs form me "RAM: 16GB" jaisi lines (ya bulk me object) -> { RAM: "16GB" }; khaali bhejo to hat jaate hain.
function readSpecs(value: unknown) {
  if (typeof value !== "string") return value;
  const lines = value
    .split("\n")
    .map((line) => line.split(":"))
    .filter((parts) => parts.length >= 2);
  if (lines.length === 0) return null;
  return Object.fromEntries(lines.map(([key, ...rest]) => [key.trim(), rest.join(":").trim()]));
}

const specs = z.preprocess(
  readSpecs,
  z
    .record(z.string().trim().min(1).max(40), z.string().trim().min(1).max(100))
    .refine((value) => Object.keys(value).length <= 20, "Max 20 specs")
    .nullable(),
);

const productFields = {
  name: z.string().trim().min(2).max(150),
  slug,
  description: z.string().trim().min(5).max(5000),
  pricePaise: z.coerce.number().int().min(1).max(1000000000),
  discountPercent: z.coerce.number().int().min(0).max(90).default(0),
  stock: z.coerce.number().int().min(0).max(100000).default(0),
  categoryId: uuid,
  brandId: z.preprocess(emptyToNull, uuid.nullable()).optional(),
  color: clearableText(30).optional(),
  gender: clearableEnum(GENDERS).optional(),
  ageGroup: clearableEnum(AGE_GROUPS).optional(),
  specs: specs.optional(),
  offerEndsAt: z
    .preprocess(emptyToNull, z.coerce.date().nullable())
    .refine((date) => !date || date.getTime() > Date.now(), "offerEndsAt must be in the future")
    .optional(),
  isTrending: formBoolean.optional(),
  isFeatured: formBoolean.optional(),
};

export const createProductSchema = z.object({
  body: z.object(productFields).strict(),
});

export const updateProductSchema = z.object({
  params: idParams,
  body: z.object(productFields).partial().extend({ isActive: formBoolean.optional() }).strict(),
});

export const bulkCreateProductSchema = z.object({
  body: z.object({
    products: z
      .array(z.object({ ...productFields, images: z.array(z.string().url()).min(1).max(6) }).strict())
      .min(1)
      .max(50),
  }),
});

export const adminListProductSchema = z.object({
  query: z.object({
    q: z.string().trim().max(100).optional(),
    ...pageParams(),
  }),
});

export const idParamSchema = z.object({ params: idParams });

export const createCategorySchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2).max(80),
      slug,
      parentId: uuid.optional(),
    })
    .strict(),
});

export const updateCategorySchema = z.object({
  params: idParams,
  body: z
    .object({
      name: z.string().trim().min(2).max(80).optional(),
      slug: slug.optional(),
      parentId: z.preprocess(emptyToNull, uuid.nullable()).optional(),
      isActive: formBoolean.optional(),
    })
    .strict(),
});

export const createBrandSchema = z.object({
  body: z.object({ name: z.string().trim().min(2).max(80), slug }).strict(),
});

export const updateBrandSchema = z.object({
  params: idParams,
  body: z.object({ name: z.string().trim().min(2).max(80).optional(), isActive: z.boolean().optional() }).strict(),
});

const bannerLink = z
  .string()
  .refine(
    (v) => (v.startsWith("/") && !v.startsWith("//")) || /^https?:\/\//.test(v),
    "Use a relative path or HTTP URL",
  );

export const createBannerSchema = z.object({
  body: z
    .object({
      link: bannerLink.optional(),
      position: z.coerce.number().int().min(0).default(0),
    })
    .strict(),
});

export const updateBannerSchema = z.object({
  params: idParams,
  body: z
    .object({
      link: bannerLink.nullable().optional(),
      position: z.number().int().min(0).optional(),
      isActive: z.boolean().optional(),
    })
    .strict(),
});

export const saleSchema = z.object({
  body: z
    .object({
      categoryId: uuid.optional(),
      discountPercent: z.number().int().min(0).max(90),
      offerEndsAt: z.coerce
        .date()
        .refine((date) => date.getTime() > Date.now(), "offerEndsAt must be in the future")
        .optional(),
    })
    .strict(),
});

export const adminListOrderSchema = z.object({
  query: z.object({
    status: orderStatus.optional(),
    needsReview: queryBoolean.optional(),
    ...pageParams(),
  }),
});

export const updateOrderStatusSchema = z.object({
  params: idParams,
  body: z.object({ status: z.enum(["SHIPPED", "DELIVERED", "CANCELLED"]) }).strict(),
});

export const adminListUserSchema = z.object({
  query: z.object({
    q: z.string().trim().max(20).optional(),
    ...pageParams(),
  }),
});

export const blockUserSchema = z.object({
  params: idParams,
  body: z.object({ isBlocked: z.boolean() }).strict(),
});

export const setUserRoleSchema = z.object({
  params: idParams,
  body: z.object({ role: z.enum(["USER", "ADMIN"]) }).strict(),
});
