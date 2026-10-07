import { z } from "zod";
import { csv, idParams, orderStatus, page, uuid } from "./common";

// idempotencyKey: double click par dusra order na bane; buyNow: sirf ek product, cart jaisa hai waisa.
export const checkoutSchema = z.object({
  body: z
    .object({
      idempotencyKey: z.string().min(8).max(100),
      addressId: uuid,
      paymentMethod: z.enum(["COD", "ONLINE"]).default("ONLINE"),
      buyNow: z
        .object({ productId: uuid, quantity: z.coerce.number().int().min(1).max(10) })
        .strict()
        .optional(),
    })
    .strict(),
});

export const orderIdSchema = z.object({ params: idParams });

// Ek se zyada status: ?status=PENDING,CONFIRMED
export const listOrderSchema = z.object({
  query: z.object({
    status: csv(orderStatus, 5).optional(),
    ...page(),
  }),
});
