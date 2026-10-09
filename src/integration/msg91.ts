import { env } from "../config/env";
import { logger } from "../config/winston";
import { AppError } from "../utils/appError";

// MSG91 se OTP ka SMS bhejo; laptop par SMS nahi jata, OTP log me dikhta hai.
export async function sendOtpSms(mobile: string, otp: string): Promise<void> {
  if (env.NODE_ENV !== "production") {
    logger.info(`DEV OTP -> ${mobile}: ${otp}`);
    return;
  }

  const params = new URLSearchParams({
    template_id: env.MSG91_OTP_TEMPLATE_ID as string,
    sender: env.MSG91_SENDER_ID as string,
    mobile: `91${mobile}`,
    otp,
  });

  try {
    const res = await fetch(`https://control.msg91.com/api/v5/otp?${params}`, {
      method: "POST",
      headers: { authkey: env.MSG91_AUTH_KEY as string },
      signal: AbortSignal.timeout(10000),
    });
    const data = (await res.json()) as { type?: string };
    if (res.ok && data.type === "success") return;
    logger.error("MSG91 failed", { status: res.status, data });
  } catch (error) {
    logger.error("MSG91 error", { error });
  }
  throw new AppError("Failed to send OTP", 503);
}
