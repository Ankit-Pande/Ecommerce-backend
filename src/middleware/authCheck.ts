import { RequestHandler } from "express";
import { Role } from "@prisma/client";
import { verifyAccessToken } from "../utils/token";
import { AppError } from "../utils/appError";
import { tokenService } from "../service/token.service";

// req.user yahi middleware set karta hai.
declare global {
  namespace Express {
    interface Request {
      user?: { userId: string; sessionId: string; role: Role };
    }
  }
}

// "Authorization: Bearer <access token>".
// Token sahi ho tab bhi session zinda honi chahiye — logout/block/role change pe
// session hat jaati hai aur purana token turant bekaar ho jaata hai.
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
