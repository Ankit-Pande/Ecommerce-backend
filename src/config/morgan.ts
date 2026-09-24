import morgan from "morgan";
import { env } from "./env";
import { logger } from "./winston";

// HTTP request log winston me. /health skip — uptime ping se log na bhare.
export const requestLogger = morgan(env.NODE_ENV === "production" ? "combined" : "dev", {
  // morgan ka req IncomingMessage hai — wahan url sach me optional hota hai.
  skip: (req) => req.url?.startsWith("/health") ?? false,
  stream: { write: (message: string) => logger.info(message.trim()) },
});
