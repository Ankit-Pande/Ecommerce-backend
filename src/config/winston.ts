import winston from "winston";
import { env } from "./env";

// Production: JSON logs Console pe — hosting (Docker/PM2/Render) khud capture +
// rotate karti hai, isliye app ke andar file-rotate nahi rakha (modern standard).
// Dev: colorized readable output taaki padhne me aasan ho.
const isDev = env.NODE_ENV === "development";

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    isDev
      ? winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(
            ({ level, message, timestamp, stack }) =>
              `${timestamp} [${level}]: ${stack || message}`
          )
        )
      : winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});
