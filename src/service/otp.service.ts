import crypto from "crypto";
import { redis } from "../config/redis";
import { AppError } from "../utils/appError";
import { generateOtp, hashOtp } from "../utils/otp";
import { smsService } from "./sms.service";

const OTP_TTL = 120; // OTP 2 min valid
const COOLDOWN = 60; // 2 send ke beech min 60s gap
const MAX_SEND = 3; // 3 send -> block
const MAX_VERIFY = 5; // 5 galat -> block
const BLOCK_TTL = 60 * 60; // 1 hour block

const otpKey = (p: string) => `otp:${p}`;
const sendKey = (p: string) => `otp:send:${p}`;
const verifyKey = (p: string) => `otp:verify:${p}`;
const blockKey = (p: string) => `otp:block:${p}`;
const cooldownKey = (p: string) => `otp:cooldown:${p}`;

export const otpService = {
  async sendOtp(phone: string): Promise<void> {
    const p = phone.trim();

    if (await redis.get(blockKey(p))) {
      throw new AppError("Blocked for 1 hour due to too many attempts", 429);
    }

    // 60s cooldown — turant dobara OTP na maange (SMS spam + accidental block rok).
    if (await redis.get(cooldownKey(p))) {
      throw new AppError("Please wait before requesting another OTP", 429);
    }

    const sendCount = Number(await redis.get(sendKey(p))) || 0;
    if (sendCount >= MAX_SEND) {
      await redis.set(blockKey(p), "1", "EX", BLOCK_TTL);
      throw new AppError("Too many attempts. Blocked for 1 hour.", 429);
    }

    const otp = generateOtp();
    const hashed = hashOtp(otp);

    // SMS pehle bhejo — fail hua to count nahi badhega (user ko bina OTP ke block na karein).
    await smsService.sendOtp(p, otp);

    const pipeline = redis.pipeline();
    pipeline.set(otpKey(p), hashed, "EX", OTP_TTL);
    pipeline.set(cooldownKey(p), "1", "EX", COOLDOWN);
    pipeline.incr(sendKey(p));
    pipeline.expire(sendKey(p), BLOCK_TTL);
    await pipeline.exec();
  },

  async verifyOtp(phone: string, otp: string): Promise<void> {
    const p = phone.trim();

    if (await redis.get(blockKey(p))) {
      throw new AppError("Blocked for 1 hour", 429);
    }

    const saved = await redis.get(otpKey(p));
    if (!saved) {
      throw new AppError("OTP expired or not requested", 400);
    }

    // Timing-safe compare (timing attack se bacha).
    const incoming = hashOtp(otp);
    const a = Buffer.from(incoming, "utf8");
    const b = Buffer.from(saved, "utf8");
    const match = a.length === b.length && crypto.timingSafeEqual(a, b);

    if (!match) {
      const attempts = await redis.incr(verifyKey(p));
      await redis.expire(verifyKey(p), OTP_TTL);
      if (attempts >= MAX_VERIFY) {
        await redis.set(blockKey(p), "1", "EX", BLOCK_TTL);
      }
      throw new AppError("Invalid OTP", 400);
    }

    // Verified -> sab keys clear (OTP single-use).
    await redis.del(otpKey(p), sendKey(p), verifyKey(p), cooldownKey(p));
  },
};
