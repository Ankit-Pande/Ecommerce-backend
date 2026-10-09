import { RequestHandler } from "express";
import { countInWindow } from "../config/redis";
import { logger } from "../config/winston";
import { AppError } from "../utils/appError";

// bucket = route ka fixed naam; allowOnRedisDown: browsing chalne do, OTP/payment roko.
interface RateLimitOptions {
  bucket: string;
  windowSec: number;
  max: number;
  allowOnRedisDown?: boolean;
}

// IP ki key: IPv6 ke sirf pehle 4 group (ek aadmi ke paas poora /64 block hota hai).
function ipKey(ip: string): string {
  if (ip.startsWith("::ffff:")) return ip.slice(7);
  if (!ip.includes(":")) return ip;

  if (!ip.includes("::")) return ip.split(":").slice(0, 4).join(":");

  const [head, tail = ""] = ip.split("::");
  const headParts = head ? head.split(":") : [];
  const tailParts = tail ? tail.split(":") : [];
  const zeros = Math.max(8 - headParts.length - tailParts.length, 0);
  return [...headParts, ...Array(zeros).fill("0"), ...tailParts].slice(0, 4).join(":");
}

// Ek aadmi zyada request na bheje: login user ko userId se, guest ko IP se gino.
export function rateLimiter({ bucket, windowSec, max, allowOnRedisDown }: RateLimitOptions): RequestHandler {
  return async (req, _res, next) => {
    try {
      const who = req.user?.userId ?? ipKey(req.ip ?? "unknown");
      const count = await countInWindow(`rate:${bucket}:${who}`, windowSec);
      if (count > max) return next(new AppError("Too many requests, please try again later.", 429));
      next();
    } catch (error) {
      logger.error("Rate limiter error", { error, bucket });
      if (allowOnRedisDown) return next();
      next(new AppError("Service busy. Please try again shortly.", 503));
    }
  };
}
