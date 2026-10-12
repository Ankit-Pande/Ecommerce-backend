import { OrderStatus } from "@prisma/client";
import { z } from "zod";

export const GENDERS = ["Men", "Women", "Unisex"] as const;
export const AGE_GROUPS = ["Adult", "Kids"] as const;

export const uuid = z.string().uuid();
export const idParams = z.object({ id: uuid });
export const idParamSchema = z.object({ params: idParams });
export const orderStatus = z.nativeEnum(OrderStatus);
export const queryBoolean = z.enum(["true", "false"]).transform((v) => v === "true");
export const phone = z.string().regex(/^[6-9]\d{9}$/, "Invalid phone number");

export const slug = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase words joined by dashes");

export const commaList = <T extends z.ZodTypeAny>(item: T, max = 20) =>
  z
    .string()
    .transform((value) =>
      value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean),
    )
    .pipe(z.array(item).min(1).max(max));

export const pageParams = (defaultLimit = 20) => ({
  cursor: uuid.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(defaultLimit),
});
