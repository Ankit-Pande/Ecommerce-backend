import { RequestHandler } from "express";
import { Role } from "@prisma/client";
import { AppError } from "../utils/appError";

export function roleCheck(...allowedRoles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) return next(new AppError("Access denied", 403));
    next();
  };
}
