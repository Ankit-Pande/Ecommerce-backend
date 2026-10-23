import crypto from "crypto";
import Razorpay from "razorpay";
import { env } from "../config/env";
import { logger } from "../config/winston";
import { AppError } from "../utils/appError";

let client: Razorpay | undefined;

// Creates the Razorpay client on first use (so development can run without keys).
function razorpayClient() {
  if (!client) {
    client = new Razorpay({ key_id: env.RAZORPAY_KEY_ID as string, key_secret: env.RAZORPAY_KEY_SECRET as string });
  }
  return client;
}

// Checks a Razorpay HMAC-SHA256 signature in constant time.
function signatureMatches(secret: string | undefined, message: string | Buffer, signature: string): boolean {
  if (!secret) return false;
  const expectedHex = crypto.createHmac("sha256", secret).update(message).digest("hex");
  const expected = Buffer.from(expectedHex);
  const given = Buffer.from(signature);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

// Creates a Razorpay order for the amount and returns its id.
export async function createRazorpayOrder(amountPaise: number, receipt: string): Promise<string> {
  try {
    const order = await razorpayClient().orders.create({ amount: amountPaise, currency: "INR", receipt });
    return order.id;
  } catch (error) {
    logger.error("Razorpay order create failed", { error });
    throw new AppError("Payment gateway is not responding. Please try again or choose Cash on Delivery.", 502);
  }
}

// Checks the checkout signature, then asks Razorpay that the payment is really captured.
export async function fetchVerifiedPayment(razorpayOrderId: string, paymentId: string, signature: string) {
  const isValidSignature = signatureMatches(env.RAZORPAY_KEY_SECRET, `${razorpayOrderId}|${paymentId}`, signature);
  if (!isValidSignature) {
    throw new AppError("Payment could not be verified", 400);
  }
  const payment = await razorpayClient().payments.fetch(paymentId);
  if (payment.status !== "captured") {
    throw new AppError("Payment is still processing. Please check again soon.", 409);
  }
  return { id: payment.id, order_id: razorpayOrderId, amount: Number(payment.amount), currency: payment.currency };
}

// Checks that a webhook really came from Razorpay.
export function verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
  return signatureMatches(env.RAZORPAY_WEBHOOK_SECRET, rawBody, signature);
}
