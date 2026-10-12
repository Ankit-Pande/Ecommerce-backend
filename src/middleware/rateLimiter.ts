import { RequestHandler } from "express";
import { countInWindow } from "../config/redis";
import { logger } from "../config/winston";
import { AppError } from "../utils/appError";

type LimitOptions = { name: string; seconds: number; maxRequests: number; allowIfRedisDown?: boolean };

function visitorIp(ip = "unknown") {
  if (ip.startsWith("::ffff:")) return ip.slice(7);
  if (!ip.includes(":")) return ip;

  const [start, end = ""] = ip.split("::");
  const head = start ? start.split(":") : [];
  const tail = end ? end.split(":") : [];
  const zeros = Array(Math.max(8 - head.length - tail.length, 0)).fill("0");
  return [...head, ...zeros, ...tail].slice(0, 4).join(":");
}

export function rateLimiter({ name, seconds, maxRequests, allowIfRedisDown = false }: LimitOptions): RequestHandler {
  return async (req, _res, next) => {
    try {
      const who = req.user?.userId ?? visitorIp(req.ip);
      const count = await countInWindow(`rate:${name}:${who}`, seconds);
      if (count > maxRequests) return next(new AppError("Too many requests, please try again later.", 429));
      next();
    } catch (error) {
      logger.error("Rate limiter error", { error, name });
      next(allowIfRedisDown ? undefined : new AppError("Service busy. Please try again shortly.", 503));
    }
  };
}
