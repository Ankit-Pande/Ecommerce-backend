import crypto from "crypto";
import { env } from "../config/env";

export function generateOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

export function hashOtp(phone: string, otp: string): string {
  return crypto.createHmac("sha256", env.OTP_SECRET).update(`${phone}:${otp}`).digest("hex");
}
