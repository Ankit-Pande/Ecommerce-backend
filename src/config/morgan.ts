import { Request, Response } from "express";
import morgan from "morgan";
import { env } from "./env";
import { logger } from "./winston";

export const requestLogger = morgan<Request, Response>(env.NODE_ENV === "production" ? "combined" : "dev", {
  skip: (req) => req.originalUrl.startsWith("/health"),
  stream: { write: (line) => logger.info(line.trim()) },
});
