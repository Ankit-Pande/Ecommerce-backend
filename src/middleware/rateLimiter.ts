import { RequestHandler } from "express";
import { countHit } from "../config/redis";
import { logger } from "../config/winston";
import { AppError } from "../utils/appError";

interface RateLimitOptions {
  bucket: string; // route ka fixed naam — req.path nahi, warna /x/1 aur /x/2 alag gine jaate
  windowSec: number;
  max: number;
  // Redis down ho to: true = request jaane do, false = rok do.
  // Browsing par true (site chalti rahe), OTP/payment par false (bina limit ke na chalein).
  allowOnRedisDown?: boolean;
}

// IPv6 me ek user ke paas poora /64 hota hai (crores addresses). Poora address ginoge to
// har request naya dikhega aur limit bekaar ho jaayegi — isliye pehle 4 group tak hi gino.
// "::" wala chhota roop pehle khola jaata hai, warna 2001:db8::1 jaisa address bina kate nikal jaata.
function ipKey(ip: string): string {
  // Node kabhi-kabhi IPv4 ko "::ffff:1.2.3.4" bhejta hai — wo IPv4 hi hai.
  if (ip.startsWith("::ffff:")) return ip.slice(7);
  if (!ip.includes(":")) return ip;

  if (!ip.includes("::")) return ip.split(":").slice(0, 4).join(":");

  const [head, tail = ""] = ip.split("::");
  const headParts = head ? head.split(":") : [];
  const tailParts = tail ? tail.split(":") : [];
  const zeros = Math.max(8 - headParts.length - tailParts.length, 0);
  return [...headParts, ...Array(zeros).fill("0"), ...tailParts].slice(0, 4).join(":");
}

// Login user ko userId se gino (ek hi WiFi ke log ek doosre ki limit na khayein), baaki IP se.
// Redis down: poori API wali limit request jaane deti hai, OTP/checkout jaisi limit rok deti hai.
export function rateLimiter({ bucket, windowSec, max, allowOnRedisDown }: RateLimitOptions): RequestHandler {
  return async (req, _res, next) => {
    try {
      const who = req.user?.userId ?? ipKey(req.ip ?? "unknown");
      const count = await countHit(`rate:${bucket}:${who}`, windowSec);
      if (count > max) return next(new AppError("Too many requests, please try again later.", 429));
      next();
    } catch (error) {
      logger.error("Rate limiter error", { error, bucket });
      if (allowOnRedisDown) return next();
      next(new AppError("Service busy. Please try again shortly.", 503));
    }
  };
}
