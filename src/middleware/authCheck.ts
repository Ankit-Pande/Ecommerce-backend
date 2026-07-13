import { RequestHandler } from "express";
import { verifyAccessToken } from "../utils/token";
import { AppError } from "../utils/appError";
import { tokenService } from "../service/token.service";
import { prisma } from "../config/db";

// Web + Android dono "Authorization: Bearer <token>" header bhejte hain (header-only,
// no cookie -> CSRF ka jhanjhat nahi, mobile-friendly).
//
// Flow ek hi middleware me (auth + block merge):
//  1. token header se nikalo + verify
//  2. jti blacklist check (logout/rotate -> redis, fast check)
//  3. user block + exist check (DB = source of truth)
export const authCheck: RequestHandler = async (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(new AppError("Login required. Token missing!", 401));
    }

    const token = authHeader.slice(7);
    const payload = verifyAccessToken(token);

    // Revoked token? (logout/refresh-rotate pe jti blacklist hota hai)
    const isBlacklisted = await tokenService.isAccessBlacklisted(payload.jti);
    if (isBlacklisted) {
      return next(new AppError("Session expired. Please login again.", 401));
    }

    // Block check DB se — source of truth.
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, role: true, isBlocked: true },
    });

    if (!user) return next(new AppError("User not found", 401));
    if (user.isBlocked) {
      return next(new AppError("Account blocked by admin", 403));
    }

    req.user = { userId: user.id, role: user.role, jti: payload.jti };
    return next();
  } catch {
    return next(
      new AppError("Invalid or expired token. Please login again.", 401)
    );
  }
};
