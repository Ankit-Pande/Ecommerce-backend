import { env } from "../config/env";
import { AppError } from "../utils/appError";
import { logger } from "../config/winston";

const isProd = env.NODE_ENV === "production";

// MSG91 OTP API (India DLT-compliant, template-based).
// Dev me actual SMS nahi bhejte — OTP log kar dete hain (testing free + fast).
// Prod me MSG91 template endpoint hit hota hai.
//
// Phone E.164 ke bina (e.g. "919876543210") MSG91 expect karta hai —
// smsService cleanup + country code handle karta hai.
export const sendOtpSms = async (
  mobile: string,
  otp: string
): Promise<void> => {
  if (!isProd) {
    logger.info(`DEV OTP -> ${mobile}: ${otp}`);
    return;
  }

  try {
    const url = "https://control.msg91.com/api/v5/otp";
    const params = new URLSearchParams({
      template_id: env.MSG91_OTP_TEMPLATE_ID as string,
      mobile,
      otp,
      sender: env.MSG91_SENDER_ID as string,
    });

    const res = await fetch(`${url}?${params.toString()}`, {
      method: "POST",
      headers: {
        authkey: env.MSG91_AUTH_KEY as string,
        "Content-Type": "application/json",
      },
    });

    const data = (await res.json()) as { type?: string; message?: string };

    if (!res.ok || data.type !== "success") {
      logger.error("MSG91 OTP send failed", { status: res.status, data });
      throw new AppError("Failed to send OTP", 503);
    }

    logger.info(`OTP sent to ${mobile}`);
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("MSG91 error", {
      error: error instanceof Error ? error.message : error,
    });
    throw new AppError("Failed to send OTP", 503);
  }
};
