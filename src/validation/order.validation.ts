import { z } from "zod";

// Checkout — cart se order banta hai. Sirf delivery address chahiye.
export const checkoutSchema = z.object({
  body: z.object({
    addressId: z.string().uuid(),
    // COD = delivery pe cash, ONLINE = Razorpay (UPI/card/netbanking).
    paymentMethod: z.enum(["COD", "ONLINE"]).default("ONLINE"),
  }),
});

export const orderIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const listOrderSchema = z.object({
  query: z.object({
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }),
});
