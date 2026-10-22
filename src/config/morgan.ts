import { Request, Response } from "express";
import morgan from "morgan";
import { logger } from "./winston";

const SLOW_REQUEST_MS = 1000;

// Writes one JSON log line per request: request id, user id, method, path, status, ms (-1 if aborted) and IP.
export const requestLogger = morgan<Request, Response>(
  (tokens, req, res) => {
    const responseTime = Number(tokens["response-time"](req, res) ?? -1);
    const level = res.statusCode >= 500 ? "error" : responseTime > SLOW_REQUEST_MS ? "warn" : "info";
    logger.log(level, "request", {
      requestId: res.locals.requestId,
      userId: req.user?.userId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      ms: responseTime,
      ip: req.ip,
    });
    return null;
  },
  { skip: (req) => req.originalUrl.startsWith("/health") },
);
