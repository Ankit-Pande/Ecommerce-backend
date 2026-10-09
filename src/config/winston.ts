import winston from "winston";
import { env } from "./env";

// Error ko log me "{}" ki jagah message aur stack ke saath likho.
const errorToText = (_key: string, value: unknown) =>
  value instanceof Error ? { message: value.message, stack: value.stack } : value;

// Laptop par log aise dikhe: "time [level]: message".
const devFormat = winston.format.printf(({ level, message, timestamp, stack, ...extra }) => {
  const details = Object.keys(extra).length ? ` ${JSON.stringify(extra, errorToText)}` : "";
  return `${timestamp} [${level}]: ${stack || message}${details}`;
});

// App ka logger: laptop par padhne layak text, live server par JSON.
export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    env.NODE_ENV === "development" ? devFormat : winston.format.json({ replacer: errorToText }),
  ),
  transports: [new winston.transports.Console()],
});
