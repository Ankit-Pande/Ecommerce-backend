import { Request, Response } from "express";
import morgan from "morgan";
import { logger } from "./winston";

const SLOW_REQUEST_MS = 1000;

// Writes one JSON log line per request: request id, user id, method, path, status, ms (-1 if aborted) and IP.
export const requestLogger = morgan<Request, Response>(
  (tokens, req, res) => {
    const responseTime = Number(tokens["response-time"](req, res) ?? -1);
    let level = "info";
    if (res.statusCode >= 500) level = "error";
    else if (responseTime > SLOW_REQUEST_MS) level = "warn";
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
