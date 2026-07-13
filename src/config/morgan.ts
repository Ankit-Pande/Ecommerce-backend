import morgan from "morgan";
import { env } from "./env";
import { logger } from "./winston";

// HTTP request logger. Output winston me pipe hota hai (ek hi jagah logs).
// /health skip (uptime ping se log spam na ho). prod: combined, dev: dev format.
const morganFormat = env.NODE_ENV === "production" ? "combined" : "dev";

export const requestLogger = morgan(morganFormat, {
  skip: (req) => req.url === "/health",
  stream: {
    write: (message: string) => {
      logger.info(message.trim());
    },
  },
});
