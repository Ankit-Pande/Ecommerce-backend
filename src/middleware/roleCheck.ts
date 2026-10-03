import { RequestHandler } from "express";
import { Role } from "@prisma/client";
import { AppError } from "../utils/appError";

// Sirf diye gaye role (jaise ADMIN) aage ja sakein — authCheck ke baad lagta hai.
export const roleCheck =
  (...allowedRoles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(new AppError("Access denied", 403));
    }
    next();
  };
