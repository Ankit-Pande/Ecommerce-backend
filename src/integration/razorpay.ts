import crypto from "crypto";
import Razorpay from "razorpay";
import { env } from "../config/env";
import { logger } from "../config/winston";
import { AppError } from "../utils/appError";

let client: Razorpay | null = null;

// Razorpay client pehli zaroorat par hi banao, taaki laptop par keys na hon to app crash na ho.
function getRazorpay(): Razorpay {
  if (!client) {
    client = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID as string,
      key_secret: env.RAZORPAY_KEY_SECRET as string,
    });
  }
  return client;
}

// Signature sahi hai ya nahi (aise compare karo ki time dekh kar andaza na lage).
function signatureMatches(secret: string | undefined, message: string | Buffer, signature: string): boolean {
  if (!secret) return false;
  const expected = Buffer.from(crypto.createHmac("sha256", secret).update(message).digest("hex"));
  const given = Buffer.from(signature);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

// Razorpay par order banao; Razorpay band ho to 502 error.
export async function createRazorpayOrder(amountPaise: number, receipt: string): Promise<string> {
  try {
    const order = await getRazorpay().orders.create({ amount: amountPaise, currency: "INR", receipt });
    return order.id;
  } catch (error) {
    logger.error("Razorpay order create failed", { error });
    throw new AppError("Payment gateway is not responding. Please try again in a moment.", 502);
  }
}

// Popup ke baad aaya payment asli hai? Signature check karo, phir Razorpay se payment ki detail lao (amount ke liye).
export async function fetchVerifiedPayment(razorpayOrderId: string, paymentId: string, signature: string) {
  if (!signatureMatches(env.RAZORPAY_KEY_SECRET, `${razorpayOrderId}|${paymentId}`, signature)) {
    throw new AppError("Payment could not be verified", 400);
  }
  const payment = await getRazorpay().payments.fetch(paymentId);
  if (payment.status !== "captured") throw new AppError("Payment is still processing. Please check again soon.", 409);
  return { id: payment.id, order_id: razorpayOrderId, amount: Number(payment.amount), currency: payment.currency };
}

// Webhook ka signature check karo; isi se nakli "payment ho gaya" message rukta hai.
export function verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
  return signatureMatches(env.RAZORPAY_WEBHOOK_SECRET, rawBody, signature);
}
