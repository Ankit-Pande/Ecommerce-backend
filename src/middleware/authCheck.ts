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

// Login zaroori: token sahi ho aur session chalu ho (logout ya block hote hi band).
export const authCheck: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw new AppError("Login required. Token missing!", 401);

    const token = header.slice("Bearer ".length);
    const { userId, sessionId } = verifyAccessToken(token);
    const role = await tokenService.getSessionRole(userId, sessionId);
    if (!role) throw new AppError("Session revoked. Please login again.", 401);

    req.user = { userId, sessionId, role };
    next();
  } catch (error) {
    next(error);
  }
};

// Login zaroori nahi: token aaya to check karo, na aaya to guest maano.
export const optionalAuth: RequestHandler = (req, res, next) => {
  if (!req.headers.authorization) return next();
  return authCheck(req, res, next);
};
