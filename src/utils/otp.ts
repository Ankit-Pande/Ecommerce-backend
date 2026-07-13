import crypto from "crypto";

// Cryptographically secure OTP (Math.random nahi).
export function generateOtp(length = 6): string {
  const min = 10 ** (length - 1);
  const max = 10 ** length;
  return crypto.randomInt(min, max).toString();
}

// OTP plain redis me store NAHI karte — hash store karte hain.
// Verify pe input ko hash karke compare. Leak ho bhi jaye to OTP safe.
export function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}
