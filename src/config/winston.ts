import winston from "winston";
import { env } from "./env";

// Error object JSON me "{}" ban jaata hai — message aur stack alag se likho,
// warna Railway logs me asli wajah dikhti hi nahi.
const showErrors = (_key: string, value: unknown) =>
  value instanceof Error ? { message: value.message, stack: value.stack } : value;

// Production: JSON console pe (Railway khud collect karta hai). Dev: rangeen text.
export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    env.NODE_ENV === "development"
      ? winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
          const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta, showErrors)}` : "";
          return `${timestamp} [${level}]: ${stack || message}${extra}`;
        })
      : winston.format.json({ replacer: showErrors }),
  ),
  transports: [new winston.transports.Console()],
});
