import { z } from "zod";
import { csv, idParams, page, uuid } from "./common";

const orderStatus = z.enum(["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"]);

// idempotencyKey: frontend har checkout click pe ek hi key bhejta hai —
// double click / retry pe dusra order nahi banta.
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

// "In progress" tab ek se zyada status maangta hai: ?status=PENDING,CONFIRMED
export const listOrderSchema = z.object({
  query: z.object({
    status: csv(orderStatus, 5).optional(),
    ...page(),
  }),
});
