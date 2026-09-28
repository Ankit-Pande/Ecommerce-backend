import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import multer from "multer";
import { ZodError } from "zod";
import { logger } from "../config/winston";
import { AppError } from "../utils/appError";

// Har error ko saaf message me badlo; andar ki detail sirf log me, user ko kabhi nahi.
export const errorHandler = (err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(err);

  const send = (status: number, message: string) => res.status(status).json({ success: false, message });

  const bodyError = (err as { type?: string })?.type;
  if (bodyError === "entity.parse.failed") return send(400, "Invalid JSON");
  if (bodyError === "entity.too.large") return send(413, "Request too large");

  if (err instanceof ZodError) {
    const message = err.issues
      .map((issue) => {
        const field = issue.path.slice(1).join(".");
        return field ? `${field}: ${issue.message}` : issue.message;
      })
      .join(", ");
    return send(400, message);
  }

  if (err instanceof multer.MulterError) {
    return send(400, err.code === "LIMIT_FILE_SIZE" ? "File too large. Max size is 2MB." : err.message);
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return send(409, "This record already exists");
    if (err.code === "P2003") return send(400, "Related record not found");
    if (err.code === "P2025") return send(404, "Record not found");
    if (err.code === "P2034") return send(409, "Request conflicted with another update. Please try again.");
  }

  if (err instanceof AppError) return send(err.statusCode, err.message);

  logger.error("Unexpected error", { error: err });
  return send(500, "Internal server error");
};
