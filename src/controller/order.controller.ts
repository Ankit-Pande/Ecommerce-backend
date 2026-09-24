import { Request, Response } from "express";
import { OrderStatus } from "@prisma/client";
import { orderService } from "../service/order.service";
import { verifyWebhookSignature } from "../integration/razorpay";
import { asyncHandler } from "../utils/asyncHandler";
import { logger } from "../config/winston";

export const checkout = asyncHandler(async (req: Request, res: Response) => {
  const { addressId, paymentMethod, idempotencyKey } = req.body;
  const result = await orderService.checkout(req.user!.userId, addressId, paymentMethod, idempotencyKey);
  res.status(201).json({ success: true, data: result });
});

export const retryPayment = asyncHandler(async (req: Request, res: Response) => {
  const result = await orderService.retryPayment(req.user!.userId, req.params.id);
  res.json({ success: true, data: result });
});

export const verifyPayment = asyncHandler(async (req: Request, res: Response) => {
  const { razorpayOrderId, razorpayPaymentId, signature } = req.body;
  const result = await orderService.verifyPayment(
    req.user!.userId,
    razorpayOrderId,
    razorpayPaymentId,
    signature,
  );
  res.json({ success: true, data: result });
});

export const listOrders = asyncHandler(async (req: Request, res: Response) => {
  const { status, cursor, limit } = req.query as unknown as {
    status?: OrderStatus[];
    cursor?: string;
    limit: number;
  };
  const result = await orderService.listForUser(req.user!.userId, status, cursor, limit);
  res.json({ success: true, ...result });
});

export const getOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.getForUser(req.user!.userId, req.params.id);
  res.json({ success: true, data: order });
});

export const cancelOrder = asyncHandler(async (req: Request, res: Response) => {
  await orderService.cancel(req.params.id, req.user!.userId);
  res.json({ success: true, message: "Order cancelled" });
});

// Razorpay webhook — app.ts me express.raw() ke saath (signature raw body pe banta hai).
// Kaam fail ho to 500 — Razorpay dobara bhejega; dobara aana safe hai (event id se).
export const razorpayWebhook = async (req: Request, res: Response) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const rawBody = req.body as Buffer;
    if (
      typeof signature !== "string" ||
      !Buffer.isBuffer(rawBody) ||
      !verifyWebhookSignature(rawBody, signature)
    ) {
      return res.status(400).json({ success: false, message: "Bad signature" });
    }

    const event = JSON.parse(rawBody.toString());
    const payment = event.payload?.payment?.entity;
    // payment.failed pe kuch nahi — user usi order pe dobara pay kar sakta hai,
    // aur deadline nikalne pe order apne aap cancel hota hai.
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
