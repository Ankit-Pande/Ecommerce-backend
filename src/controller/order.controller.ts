import { Request, Response } from "express";
import { orderService } from "../service/order.service";
import { verifyWebhookSignature } from "../integration/razorpay";
import { asyncHandler } from "../utils/asyncHandler";
import { logger } from "../config/winston";

// Checkout — cart se Razorpay order banta hai. Frontend isi se payment popup kholta hai.
export const checkout = asyncHandler(async (req: Request, res: Response) => {
  const result = await orderService.checkout(
    req.user!.userId,
    req.body.addressId,
    req.body.paymentMethod
  );
  res.status(201).json({ success: true, data: result });
});

// Razorpay webhook — app.ts me express.raw() se mount hai (raw body signature ke liye).
// asyncHandler nahi (yahan req.body Buffer hai, alag handling). Hamesha 200 do warna
// Razorpay retry karta rahega; kaam andar idempotent hai.
export const razorpayWebhook = async (req: Request, res: Response) => {
  try {
    const signature = req.headers["x-razorpay-signature"] as string;
    const rawBody = req.body as Buffer;

    if (!signature || !verifyWebhookSignature(rawBody, signature)) {
      return res.status(400).json({ success: false, message: "Bad signature" });
    }

    const event = JSON.parse(rawBody.toString());
    const entity = event.payload?.payment?.entity;

    if (event.event === "payment.captured" && entity) {
      await orderService.handlePaymentSuccess(
        entity.order_id,
        entity.id,
        signature
      );
    } else if (event.event === "payment.failed" && entity) {
      await orderService.handlePaymentFailed(entity.order_id);
    }

    return res.json({ success: true });
  } catch (err) {
    logger.error("Razorpay webhook error", { err });
    // 200 hi do — retry-storm se bachne ke liye. Error log ho gaya.
    return res.json({ success: true });
  }
};

export const listOrders = asyncHandler(async (req: Request, res: Response) => {
  const { cursor, limit } = req.query as unknown as {
    cursor?: string;
    limit: number;
  };
  const result = await orderService.listForUser(req.user!.userId, cursor, limit);
  res.json({ success: true, ...result });
});

// Order cancel — PENDING/CONFIRMED tak. Paid tha to refund manual (message me bata do).
export const cancelOrder = asyncHandler(async (req: Request, res: Response) => {
  const result = await orderService.cancelForUser(req.user!.userId, req.params.id);
  res.json({
    success: true,
    message: result.refundPending
      ? "Order cancelled. Your refund will be processed within 5-7 working days."
      : "Order cancelled",
  });
});

export const getOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.getForUser(req.user!.userId, req.params.id);
  res.json({ success: true, data: order });
});
