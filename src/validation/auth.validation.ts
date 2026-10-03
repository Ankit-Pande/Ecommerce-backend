import { z } from "zod";

// 10 digit number; +91, space aur dash ke saath bhi chalega ("+91 98765-43210").
const loginPhone = z
  .string()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^(\+?91)?[6-9]\d{9}$/, "Invalid mobile number (example: 9876543210)"));

export const sendOtpSchema = z.object({
  body: z.object({ phone: loginPhone }).strict(),
});

export const verifyOtpSchema = z.object({
  body: z
    .object({
      phone: loginPhone,
      otp: z.string().regex(/^\d{6}$/, "OTP must be exactly 6 digits"),
    })
    .strict(),
});
