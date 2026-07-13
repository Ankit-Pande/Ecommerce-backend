import { RequestHandler } from "express";
import { verifyAccessToken } from "../utils/token";

// Assistant guest ko bhi milta hai — token ho to user/admin ban jao, na ho (ya galat ho)
// to chupchap guest. Yahan DB check nahi (chat fast rahe); asli protected kaam
// (cart/order) apne authCheck se hi hota hai.
export const optionalAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const payload = verifyAccessToken(header.slice(7));
      req.user = { userId: payload.userId, role: payload.role, jti: payload.jti };
    } catch {
      // invalid/expired token -> guest hi sahi
    }
  }
  return next();
};
