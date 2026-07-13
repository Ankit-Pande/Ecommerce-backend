import { RequestHandler } from "express";
import { redis } from "../config/redis";
import { logger } from "../config/winston";
import { AppError } from "../utils/appError";

// Generic reusable rate limiter (IP + named bucket).
// 'bucket' fixed string lo (route ka naam), req.path NAHI — warna dynamic params
// (/user/123 vs /user/456) alag keys bana ke limit bypass ho jaati hai.
// Use: rateLimiter({ bucket: "login", windowSec: 60, max: 5 })
interface RateLimiterOptions {
  bucket: string;
  windowSec: number;
  max: number;
}

export function rateLimiter(options: RateLimiterOptions): RequestHandler {
  return async (req, _res, next) => {
    try {
      const clientId = req.ip || "unknown";
      const key = `rate:${options.bucket}:${clientId}`;

      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, options.windowSec);
      }

      if (count > options.max) {
        return next(
          new AppError("Too many requests, please try again later.", 429)
        );
      }

      return next();
    } catch (error) {
      // Redis down -> request block mat karo (fail-open). Log karke aage jaane do.
      logger.error("Rate limiter error", { error });
      return next();
    }
  };
}

// OTP-specific IP limiter: 30 OTP / hour -> 30 min block.
// (Phone-based limit otp.service me: 60s cooldown + 3 OTP / 10 min.)
const OTP_IP_MAX = 30;
const OTP_IP_WINDOW = 60 * 60; // 1 hour
const OTP_IP_BLOCK = 30 * 60; // 30 min

export const otpIpLimiter: RequestHandler = async (req, _res, next) => {
  try {
    const ip = req.ip || "unknown";
    const blockKey = `otp:ipblock:${ip}`;
    const countKey = `otp:ipcount:${ip}`;

    if (await redis.get(blockKey)) {
      return next(
        new AppError(
          "Too many OTP requests from your network. Try again after 30 minutes",
          429
        )
      );
    }

    const count = await redis.incr(countKey);
    if (count === 1) await redis.expire(countKey, OTP_IP_WINDOW);

    if (count > OTP_IP_MAX) {
      await redis.set(blockKey, "1", "EX", OTP_IP_BLOCK);
      return next(
        new AppError(
          "Too many OTP requests from your network. Try again after 30 minutes",
          429
        )
      );
    }

    return next();
  } catch (error) {
    logger.error("OTP IP limiter error", { error });
    return next();
  }
};
