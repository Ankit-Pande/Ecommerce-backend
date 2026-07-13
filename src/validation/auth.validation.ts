import { z } from "zod";

// Indian mobile: 10-digit (6-9 se start) ya +91/91 prefix.
// sms.service isi ko normalize karke MSG91 ko "91XXXXXXXXXX" deta hai.
const indianPhone = z
  .string()
  .trim()
  .regex(
    /^(\+?91)?[6-9]\d{9}$/,
    "Invalid mobile number (example: 9876543210 or +919876543210)"
  );

export const sendOtpSchema = z.object({
  body: z.object({ phone: indianPhone }).strict(),
});

export const verifyOtpSchema = z.object({
  body: z
    .object({
      phone: indianPhone,
      otp: z.string().regex(/^\d{6}$/, "OTP must be exactly 6 digits"),
    })
    .strict(),
});

// Refresh token cookie (web) ya body (Android) se aa sakta — dono optional yahan,
// controller check karta hai ki kam se kam ek zaroor ho.
export const refreshSchema = z.object({
  body: z.object({ refreshToken: z.string().min(1).optional() }).strict(),
});

export const logoutSchema = z.object({
  body: z.object({ refreshToken: z.string().min(1).optional() }).strict(),
});
