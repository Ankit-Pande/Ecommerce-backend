import crypto from "crypto";
import Razorpay from "razorpay";
import { env } from "../config/env";
import { logger } from "../config/winston";
import { AppError } from "../utils/appError";

let client: Razorpay | undefined;

function razorpay() {
  client ??= new Razorpay({ key_id: env.RAZORPAY_KEY_ID as string, key_secret: env.RAZORPAY_KEY_SECRET as string });
  return client;
}

function signatureMatches(secret: string | undefined, message: string | Buffer, signature: string): boolean {
  if (!secret) return false;
  const expected = Buffer.from(crypto.createHmac("sha256", secret).update(message).digest("hex"));
  const given = Buffer.from(signature);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

export async function createRazorpayOrder(amountPaise: number, receipt: string): Promise<string> {
  try {
    const order = await razorpay().orders.create({ amount: amountPaise, currency: "INR", receipt });
    return order.id;
  } catch (error) {
    logger.error("Razorpay order create failed", { error });
    throw new AppError("Payment gateway is not responding. Please try again in a moment.", 502);
  }
}

export async function fetchVerifiedPayment(razorpayOrderId: string, paymentId: string, signature: string) {
  if (!signatureMatches(env.RAZORPAY_KEY_SECRET, `${razorpayOrderId}|${paymentId}`, signature)) {
    throw new AppError("Payment could not be verified", 400);
  }
  const payment = await razorpay().payments.fetch(paymentId);
  if (payment.status !== "captured") throw new AppError("Payment is still processing. Please check again soon.", 409);
  return { id: payment.id, order_id: razorpayOrderId, amount: Number(payment.amount), currency: payment.currency };
}

export function verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
  return signatureMatches(env.RAZORPAY_WEBHOOK_SECRET, rawBody, signature);
}
