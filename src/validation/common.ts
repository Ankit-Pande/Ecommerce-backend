import { OrderStatus } from "@prisma/client";
import { z } from "zod";

// Kai validation files me ek jaise fields.
export const uuid = z.string().uuid();
export const idParams = z.object({ id: uuid });

// Query string me boolean "true"/"false" text aata hai.
export const queryBoolean = z.enum(["true", "false"]).transform((v) => v === "true");

// Prisma ke enum se — naya status jude to yahan apne aap aa jaata hai.
export const orderStatus = z.nativeEnum(OrderStatus);

// 10 digit Indian mobile (address, alternate phone).
export const phone = z.string().regex(/^[6-9]\d{9}$/, "Invalid phone number");

export const slug = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase words joined by dashes");

// Admin ye value set karta hai aur catalog filter isi par chalta hai — dono ek hi list se.
export const GENDERS = ["Men", "Women", "Unisex"] as const;
export const AGE_GROUPS = ["Adult", "Kids"] as const;

// Multi-select filter URL me comma se: ?brand=nova,urban
export const csv = <T extends z.ZodTypeAny>(item: T, max = 20) =>
  z
    .string()
    .transform((value) =>
      value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean),
    )
    .pipe(z.array(item).min(1).max(max));

// Har list cursor pagination par (offset nahi — bade catalog pe slow hota hai).
export const page = (defaultLimit = 20) => ({
  cursor: uuid.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(defaultLimit),
});
