import { z } from "zod";
import { idParams, uuid } from "./common";

const quantity = z.coerce.number().int().min(1).max(10);
const option = z.string().trim().max(30).optional();

export const addToCartSchema = z.object({
  body: z.object({ productId: uuid, quantity: quantity.default(1), size: option, color: option }).strict(),
});

export const updateCartItemSchema = z.object({
  params: idParams,
  body: z.object({ quantity }).strict(),
});
