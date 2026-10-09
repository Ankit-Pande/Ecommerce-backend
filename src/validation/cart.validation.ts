import { z } from "zod";
import { uuid } from "./common";

const quantity = z.coerce.number().int().min(1).max(10);

export const addToCartSchema = z.object({
  body: z.object({ productId: uuid, quantity: quantity.default(1) }).strict(),
});

export const updateCartItemSchema = z.object({
  params: z.object({ productId: uuid }),
  body: z.object({ quantity }).strict(),
});

export const cartItemParamSchema = z.object({
  params: z.object({ productId: uuid }),
});
