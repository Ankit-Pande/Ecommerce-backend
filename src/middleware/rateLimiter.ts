import { timingSafeEqual } from "crypto";
import { Request, RequestHandler } from "express";
import { env } from "../config/env";
import { countInWindow } from "../config/redis";
import { logger } from "../config/winston";
import { AppError } from "../utils/appError";
import { verifyAccessToken } from "../utils/token";

type LimitOptions = { name: string; seconds: number; maxRequests: number; allowIfRedisDown?: boolean };

// The IP used for limits: IPv4 as it is, IPv6 cut to its /64 network (one home or phone gets many IPv6 addresses).
export function visitorIp(ip = "unknown") {
  if (ip.startsWith("::ffff:")) return ip.slice(7);
  if (!ip.includes(":")) return ip;

  const [leftPart = "", rightPart = ""] = ip.split("::");
  const leftBlocks = leftPart ? leftPart.split(":") : [];
  const rightBlocks = rightPart ? rightPart.split(":") : [];
  const missingCount = Math.max(8 - leftBlocks.length - rightBlocks.length, 0);
  const middleZeroBlocks = Array(missingCount).fill("0");
  const fullAddress = [...leftBlocks, ...middleZeroBlocks, ...rightBlocks];
  return fullAddress.slice(0, 4).join(":");
}

// Who a limit counts: the user of a valid access token, otherwise the visitor's IP.
function visitorOf(req: Request): string {
  if (req.user) return req.user.userId;
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const token = header.slice("Bearer ".length);
      return verifyAccessToken(token).userId;
    } catch {
      return visitorIp(req.ip);
    }
  }
  return visitorIp(req.ip);
}

// True when the request has our frontend server's key; its page loads come from one IP for every visitor.
function fromFrontendServer(req: Request) {
  const key = req.headers["x-internal-key"];
  if (!env.INTERNAL_API_KEY || typeof key !== "string") return false;
  const expected = Buffer.from(env.INTERNAL_API_KEY);
  const given = Buffer.from(key);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

// Allows maxRequests per visitor in each window of `seconds`, then answers 429; the frontend server is not limited.
export function rateLimiter({ name, seconds, maxRequests, allowIfRedisDown = false }: LimitOptions): RequestHandler {
  return async (req, _res, next) => {
    if (fromFrontendServer(req)) return next();
    try {
      const visitor = visitorOf(req);
      const count = await countInWindow(`rate:${name}:${visitor}`, seconds);
      if (count > maxRequests) {
        return next(new AppError("Too many requests, please try again later.", 429));
      }
      next();
    } catch (error) {
      logger.error("Rate limiter error", { error, name });
      if (allowIfRedisDown) return next();
      next(new AppError("Service busy. Please try again shortly.", 503));
    }
  };
}
