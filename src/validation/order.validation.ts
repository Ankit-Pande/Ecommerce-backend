import { z } from "zod";
import { csv, idParams, orderStatus, page, uuid } from "./common";

// idempotencyKey: double click ya retry par dusra order na bane.
export const checkoutSchema = z.object({
  body: z
    .object({
      idempotencyKey: z.string().min(8).max(100),
      addressId: uuid,
      paymentMethod: z.enum(["COD", "ONLINE"]).default("ONLINE"),
    })
    .strict(),
});

export const verifyPaymentSchema = z.object({
  body: z
    .object({
      razorpayOrderId: z.string().min(1).max(100),
      razorpayPaymentId: z.string().min(1).max(100),
      signature: z.string().min(1).max(200),
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
