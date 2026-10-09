import { RequestHandler } from "express";
import { countInWindow } from "../config/redis";
import { logger } from "../config/winston";
import { AppError } from "../utils/appError";

interface LimitOptions {
  name: string;
  seconds: number;
  maxRequests: number;
  allowIfRedisDown?: boolean;
}

// Guest ki pehchaan IP se. IPv6 me sirf pehle 4 hisse lo (ek ghar ke saare device ek hi gine jayein).
function visitorIp(ip: string): string {
  if (ip.startsWith("::ffff:")) return ip.slice(7);
  if (!ip.includes(":")) return ip;
  if (!ip.includes("::")) return ip.split(":").slice(0, 4).join(":");

  const [start, end = ""] = ip.split("::");
  const startParts = start ? start.split(":") : [];
  const endParts = end ? end.split(":") : [];
  const zeros = Array(Math.max(8 - startParts.length - endParts.length, 0)).fill("0");
  return [...startParts, ...zeros, ...endParts].slice(0, 4).join(":");
}

// Ek aadmi zyada request na bheje: login user ko userId se, guest ko IP se gino.
export function rateLimiter({ name, seconds, maxRequests, allowIfRedisDown }: LimitOptions): RequestHandler {
  return async (req, _res, next) => {
    try {
      const who = req.user?.userId ?? visitorIp(req.ip ?? "unknown");
      const count = await countInWindow(`rate:${name}:${who}`, seconds);
      if (count > maxRequests) return next(new AppError("Too many requests, please try again later.", 429));
      next();
    } catch (error) {
      logger.error("Rate limiter error", { error, name });
      if (allowIfRedisDown) return next();
      next(new AppError("Service busy. Please try again shortly.", 503));
    }
  };
}
