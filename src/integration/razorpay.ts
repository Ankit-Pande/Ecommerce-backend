import crypto from "crypto";
import Razorpay from "razorpay";
import { env } from "../config/env";

// Razorpay client — order create ke liye.
export const razorpay = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID as string,
  key_secret: env.RAZORPAY_KEY_SECRET as string,
});

// Webhook signature verify — Razorpay ke raw body pe HMAC-SHA256.
// Galat signature = koi fake payment confirm na kar paaye (security must).
export const verifyWebhookSignature = (
  rawBody: Buffer,
  signature: string
): boolean => {
  const expected = crypto
    .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET as string)
    .update(rawBody)
    .digest("hex");
  // timing-safe compare
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
