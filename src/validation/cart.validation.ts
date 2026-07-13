import { z } from "zod";

export const addToCartSchema = z.object({
  body: z.object({
    productId: z.string().uuid(),
    quantity: z.coerce.number().int().min(1).max(10).default(1),
  }),
});

export const updateCartItemSchema = z.object({
  params: z.object({ productId: z.string().uuid() }),
  body: z.object({
    quantity: z.coerce.number().int().min(1).max(10),
  }),
});

export const cartItemParamSchema = z.object({
  params: z.object({ productId: z.string().uuid() }),
});
