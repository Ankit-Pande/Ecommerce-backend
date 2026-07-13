import { RequestHandler } from "express";
import { AppError } from "../utils/appError";

// Sirf diye gaye role wale aage ja sakte hain (admin routes ke liye).
// authCheck ke baad lagta hai (req.user set ho chuka hota hai).
export const roleCheck = (...allowedRoles: string[]): RequestHandler => {
  return (req, _res, next) => {
    if (!req.user) return next(new AppError("Unauthorized", 401));
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError("Access denied", 403));
    }
    return next();
  };
};
