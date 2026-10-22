import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import multer from "multer";
import { ZodError } from "zod";
import { logger } from "../config/winston";
import { AppError } from "../utils/appError";

// Turns any error into { success: false, message } with the right status; unexpected errors are logged as 500.
export function errorHandler(error: unknown, req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) return next(error);

  // Sends the error reply.
  const send = (status: number, message: string) => res.status(status).json({ success: false, message });

  const bodyError = (error as { type?: string })?.type;
  if (bodyError === "entity.parse.failed") return send(400, "Invalid JSON");
  if (bodyError === "entity.too.large") return send(413, "Request too large");

  if (error instanceof ZodError) {
    const message = error.issues
      .map((issue) => {
        const field = issue.path.slice(1).join(".");
        return field ? `${field}: ${issue.message}` : issue.message;
      })
      .join(", ");
    return send(400, message);
  }

  if (error instanceof multer.MulterError) {
    return send(400, error.code === "LIMIT_FILE_SIZE" ? "File too large. Max size is 2MB." : error.message);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return send(409, "This record already exists");
    if (error.code === "P2003") return send(400, "Related record not found");
    if (error.code === "P2025") return send(404, "Record not found");
    if (error.code === "P2034") return send(409, "Request conflicted with another update. Please try again.");
    if (error.code === "P2024" || error.code === "P2028") return send(503, "Server busy. Please try again.");
  }
  if (error instanceof Prisma.PrismaClientInitializationError) return send(503, "Server busy. Please try again.");

  if (error instanceof AppError) return send(error.statusCode, error.message);

  logger.error("Unexpected error", {
    error,
    requestId: res.locals.requestId,
    userId: req.user?.userId,
    method: req.method,
    path: req.originalUrl,
  });
  return send(500, "Internal server error");
}
