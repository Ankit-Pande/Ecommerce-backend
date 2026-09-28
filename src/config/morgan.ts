import morgan from "morgan";
import { env } from "./env";
import { logger } from "./winston";

// Har request ka log (/health chhod kar).
export const requestLogger = morgan(env.NODE_ENV === "production" ? "combined" : "dev", {
  skip: (req) => req.url?.startsWith("/health") ?? false,
  stream: { write: (message: string) => logger.info(message.trim()) },
});
