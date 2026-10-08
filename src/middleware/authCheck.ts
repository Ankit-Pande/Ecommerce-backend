import { RequestHandler } from "express";
import { Role } from "@prisma/client";
import { verifyAccessToken } from "../utils/token";
import { AppError } from "../utils/appError";
import { tokenService } from "../service/token.service";

declare global {
  namespace Express {
    interface Request {
      user?: { userId: string; sessionId: string; role: Role };
    }
  }
}

// Login zaroori: token check + session zinda hai (logout/block par turant bekaar).
export const authCheck: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw new AppError("Login required. Token missing!", 401);

    const { userId, sessionId } = verifyAccessToken(header.slice(7));
    const role = await tokenService.getSessionRole(userId, sessionId);
    if (!role) throw new AppError("Session revoked. Please login again.", 401);

    req.user = { userId, sessionId, role };
    next();
  } catch (error) {
    next(error);
  }
};

// Login optional: token aaya to wahi check (galat ho to 401), na aaye to guest.
export const optionalAuth: RequestHandler = (req, res, next) => {
  if (!req.headers.authorization) return next();
  return authCheck(req, res, next);
};
