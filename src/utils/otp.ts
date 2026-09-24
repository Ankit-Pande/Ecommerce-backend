import crypto from "crypto";
import { env } from "../config/env";

// Math.random nahi — crypto se 6 digit.
export function generateOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

// Redis me OTP plain nahi rakhte. Phone + server secret ke saath hash — leak ho to bhi bekaar.
export function hashOtp(phone: string, otp: string): string {
  return crypto.createHmac("sha256", env.OTP_SECRET).update(`${phone}:${otp}`).digest("hex");
}
