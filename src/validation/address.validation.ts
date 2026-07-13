import { z } from "zod";

// Indian pincode = 6 digit. Phone = 10 digit.
const pincode = z.string().regex(/^[1-9][0-9]{5}$/, "Invalid pincode");
const phone = z.string().regex(/^[6-9][0-9]{9}$/, "Invalid phone number");

export const createAddressSchema = z.object({
  body: z.object({
    fullName: z.string().trim().min(2).max(80),
    phone,
    line1: z.string().trim().min(3).max(150),
    line2: z.string().trim().max(150).optional(),
    city: z.string().trim().min(2).max(60),
    state: z.string().trim().min(2).max(60),
    pincode,
    isDefault: z.boolean().optional(),
  }),
});

export const updateAddressSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: createAddressSchema.shape.body.partial(),
});

export const addressIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});
