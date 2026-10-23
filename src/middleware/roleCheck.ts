import { RequestHandler } from "express";
import { Role } from "@prisma/client";
import { AppError } from "../utils/appError";

// Lets the request through only when the logged-in user has one of the given roles.
export function roleCheck(...allowedRoles: Role[]): RequestHandler {
  return (req, _res, next) => {
    const allowed = req.user !== undefined && allowedRoles.includes(req.user.role);
    if (!allowed) return next(new AppError("Access denied", 403));
    next();
  };
}
