import crypto from "crypto";
import Razorpay from "razorpay";
import { env } from "../config/env";
import { logger } from "../config/winston";
import { AppError } from "../utils/appError";

let client: Razorpay | null = null;

// Pehli zaroorat pe banao — dev me keys khaali hon to app start pe crash na ho.
function getRazorpay(): Razorpay {
  if (!client) {
    client = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID as string,
      key_secret: env.RAZORPAY_KEY_SECRET as string,
    });
  }
  return client;
}

// HMAC-SHA256 timing-safe compare. Secret hi na ho to "match nahi".
function signatureMatches(secret: string | undefined, message: string | Buffer, signature: string): boolean {
  if (!secret) return false;
  const expected = Buffer.from(crypto.createHmac("sha256", secret).update(message).digest("hex"));
  const given = Buffer.from(signature);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

// Razorpay par order banao. Gateway down ho to saaf 502 — warna generic 500 jaata tha
// aur user ko samajh hi nahi aata ki galti uski nahi hai.
export async function createRazorpayOrder(amountPaise: number, receipt: string): Promise<string> {
  try {
    const order = await getRazorpay().orders.create({ amount: amountPaise, currency: "INR", receipt });
    return order.id;
  } catch (error) {
    logger.error("Razorpay order create failed", { error });
    throw new AppError("Payment gateway is not responding. Please try again in a moment.", 502);
  }
}

// Checkout popup ke baad browser se aaya signature ("orderId|paymentId" par).
export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  return signatureMatches(env.RAZORPAY_KEY_SECRET, `${orderId}|${paymentId}`, signature);
}

// Webhook ka signature poori raw body par — fake "payment ho gaya" isi se rukta hai.
export function verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
  return signatureMatches(env.RAZORPAY_WEBHOOK_SECRET, rawBody, signature);
}
