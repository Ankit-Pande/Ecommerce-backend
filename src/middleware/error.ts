import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import multer from "multer";
import { ZodError } from "zod";
import { logger } from "../config/winston";
import { AppError } from "../utils/appError";

// Central error handler — app ka aakhri middleware. Saari errors yahin convert hoti hain.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Zod validation (validate middleware se raw ZodError aata hai)
  if (err instanceof ZodError) {
    const message = err.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");
    return res.status(400).json({ success: false, message });
  }

  // Multer (photo upload) — file size/type
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ success: false, message: "File too large. Max size is 2MB." });
    }
    return res.status(400).json({ success: false, message: err.message });
  }

  // Prisma known errors -> friendly message
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res
        .status(409)
        .json({ success: false, message: "This record already exists" });
    }
    if (err.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, message: "Record not found" });
    }
  }

  // Operational (humari expected) error
  if (err instanceof AppError) {
    return res
      .status(err.statusCode)
      .json({ success: false, message: err.message });
  }

  // Unknown -> log full, client ko generic 500
  logger.error("Unexpected error", {
    error: err instanceof Error ? err.stack : err,
  });
  return res
    .status(500)
    .json({ success: false, message: "Internal server error" });
};
