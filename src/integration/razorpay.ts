import crypto from "crypto";
import Razorpay from "razorpay";
import { env } from "../config/env";
import { logger } from "../config/winston";
import { AppError } from "../utils/appError";

let client: Razorpay | null = null;

// Razorpay client pehli baar zaroorat par banao (dev me keys na hon to crash na ho).
function getRazorpay(): Razorpay {
  if (!client) {
    client = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID as string,
      key_secret: env.RAZORPAY_KEY_SECRET as string,
    });
  }
  return client;
}

// Signature sahi hai ya nahi (safe compare).
function signatureMatches(secret: string | undefined, message: string | Buffer, signature: string): boolean {
  if (!secret) return false;
  const expected = Buffer.from(crypto.createHmac("sha256", secret).update(message).digest("hex"));
  const given = Buffer.from(signature);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

// Razorpay par order banao; gateway down ho to 502.
export async function createRazorpayOrder(amountPaise: number, receipt: string): Promise<string> {
  try {
    const order = await getRazorpay().orders.create({ amount: amountPaise, currency: "INR", receipt });
    return order.id;
  } catch (error) {
    logger.error("Razorpay order create failed", { error });
    throw new AppError("Payment gateway is not responding. Please try again in a moment.", 502);
  }
}

// Payment popup ke baad browser se aaya signature check karo.
export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  return signatureMatches(env.RAZORPAY_KEY_SECRET, `${orderId}|${paymentId}`, signature);
}

// Webhook ka signature check — nakli "payment ho gaya" isi se rukta hai.
export function verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
  return signatureMatches(env.RAZORPAY_WEBHOOK_SECRET, rawBody, signature);
}
