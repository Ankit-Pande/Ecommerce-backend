import morgan from "morgan";
import { env } from "./env";
import { logger } from "./winston";

// Har request ki ek line log me (/health wali chhod kar).
export const requestLogger = morgan(env.NODE_ENV === "production" ? "combined" : "dev", {
  skip: (req) => req.url?.startsWith("/health") ?? false,
  stream: { write: (line: string) => logger.info(line.trim()) },
});
