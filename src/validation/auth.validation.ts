import { z } from "zod";

// 10 digit ya +91/91 ke saath. Service ise 10 digit me badal deti hai.
const loginPhone = z
  .string()
  .trim()
  .regex(/^(\+?91)?[6-9]\d{9}$/, "Invalid mobile number (example: 9876543210)");

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
