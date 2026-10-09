import { Request, Response } from "express";
import { OrderStatus } from "@prisma/client";
import { orderService } from "../service/order.service";
import { verifyWebhookSignature } from "../integration/razorpay";
import { asyncHandler } from "../utils/asyncHandler";
import { logger } from "../config/winston";

// Order banao (COD ya online).
export const checkout = asyncHandler(async (req: Request, res: Response) => {
  const { addressId, paymentMethod, idempotencyKey, buyNow } = req.body;
  const result = await orderService.checkout(req.user!.userId, addressId, paymentMethod, idempotencyKey, buyNow);
  res.status(201).json({ success: true, data: result });
});

// Unpaid order ka payment dobara karo.
export const retryPayment = asyncHandler(async (req: Request, res: Response) => {
  const result = await orderService.retryPayment(req.user!.userId, req.params.id);
  res.json({ success: true, data: result });
});

// User ke orders.
export const listOrders = asyncHandler(async (req: Request, res: Response) => {
  const { status, cursor, limit } = req.query as unknown as {
    status?: OrderStatus[];
    cursor?: string;
    limit: number;
  };
  const result = await orderService.listForUser(req.user!.userId, status, cursor, limit);
  res.json({ success: true, ...result });
});

// User ka ek order poori detail ke saath.
export const getOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.getForUser(req.user!.userId, req.params.id);
  res.json({ success: true, data: order });
});

// User apna order cancel kare.
export const cancelOrder = asyncHandler(async (req: Request, res: Response) => {
  await orderService.cancel(req.params.id, req.user!.userId);
  res.json({ success: true, message: "Order cancelled" });
});

// Razorpay ka payment message: pehle check ki asli hai, phir order confirm. Fail ho to 500, Razorpay dobara bhejega.
export const razorpayWebhook = async (req: Request, res: Response) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const rawBody = req.body as Buffer;
    if (typeof signature !== "string" || !Buffer.isBuffer(rawBody) || !verifyWebhookSignature(rawBody, signature)) {
      return res.status(400).json({ success: false, message: "Bad signature" });
    }

    const event = JSON.parse(rawBody.toString());
    const payment = event.payload?.payment?.entity;
    if (event.event === "payment.captured" && payment) {
      const eventId = req.headers["x-razorpay-event-id"];
      await orderService.handlePaymentCaptured(typeof eventId === "string" ? eventId : payment.id, payment);
    }
    res.json({ success: true });
  } catch (error) {
    logger.error("Razorpay webhook failed", { error });
    res.status(500).json({ success: false });
  }
};
