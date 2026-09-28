import winston from "winston";
import { env } from "./env";

// Error log me "{}" na dikhe, isliye message aur stack alag se likho.
const showErrors = (_key: string, value: unknown) =>
  value instanceof Error ? { message: value.message, stack: value.stack } : value;

// Logger: production me JSON, dev me padhne layak text.
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
