import { RequestHandler } from "express";
import { Role } from "@prisma/client";
import { AppError } from "../utils/appError";

// Lets the request through only when the logged-in user has one of the given roles.
export function roleCheck(...allowedRoles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) return next(new AppError("Access denied", 403));
    next();
  };
}
