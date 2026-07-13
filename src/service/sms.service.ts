import { sendOtpSms } from "../integration/msg91";
import { AppError } from "../utils/appError";

// Indian mobile: +91 ke saath ya bina. MSG91 ko "91XXXXXXXXXX" (country code + 10 digit) chahiye.
// User "+919876543210", "919876543210", ya "9876543210" bhej sakta hai — normalize karo.
const normalizeIndianMobile = (phone: string): string => {
  let p = phone.trim().replace(/[\s\-+]/g, "");
  if (p.length === 10) p = `91${p}`; // sirf 10 digit -> 91 prepend
  return p;
};

// 91 + 10 digit (Indian). MSG91 isi format me OTP bhejta hai.
const indianMobileRegex = /^91[6-9]\d{9}$/;

export const smsService = {
  async sendOtp(phone: string, otp: string): Promise<void> {
    const mobile = normalizeIndianMobile(phone);
    if (!indianMobileRegex.test(mobile)) {
      throw new AppError("Invalid mobile number. Use a valid Indian number", 400);
    }
    await sendOtpSms(mobile, otp);
  },
};
