import { z } from "zod";
import { idParams, phone } from "./common";

const addressBody = z
  .object({
    fullName: z.string().trim().min(2).max(80),
    phone,
    line1: z.string().trim().min(3).max(150),
    line2: z.string().trim().max(150).optional(),
    city: z.string().trim().min(2).max(60),
    state: z.string().trim().min(2).max(60),
    pincode: z.string().regex(/^[1-9]\d{5}$/, "Invalid pincode"),
    isDefault: z.boolean().optional(),
  })
  .strict();

export const createAddressSchema = z.object({ body: addressBody });

export const updateAddressSchema = z.object({
  params: idParams,
  body: addressBody.partial(),
});

export const addressIdSchema = z.object({ params: idParams });
