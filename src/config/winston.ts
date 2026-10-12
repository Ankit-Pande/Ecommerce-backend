import winston from "winston";
import { env } from "./env";

const showError = (_key: string, value: unknown) =>
  value instanceof Error ? { message: value.message, stack: value.stack } : value;

const devFormat = winston.format.printf(({ level, message, timestamp, stack, ...extra }) => {
  const details = Object.keys(extra).length > 0 ? ` ${JSON.stringify(extra, showError)}` : "";
  return `${timestamp} [${level}]: ${stack || message}${details}`;
});

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    env.NODE_ENV === "development" ? devFormat : winston.format.json({ replacer: showError }),
  ),
  transports: [new winston.transports.Console()],
});
