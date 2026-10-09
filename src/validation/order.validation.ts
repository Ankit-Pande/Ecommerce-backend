import { z } from "zod";
import { commaList, idParams, orderStatus, pageParams, uuid } from "./common";

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

export const listOrderSchema = z.object({
  query: z.object({
    status: commaList(orderStatus, 5).optional(),
    ...pageParams(),
  }),
});
