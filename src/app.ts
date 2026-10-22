import { randomUUID } from "crypto";
import compression from "compression";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import { requestLogger } from "./config/morgan";
import { razorpayWebhook } from "./controller/order.controller";
import { errorHandler } from "./middleware/error";
import { rateLimiter } from "./middleware/rateLimiter";
import { apiRoutes } from "./routes";
import { healthRoutes } from "./routes/health.routes";
import { AppError } from "./utils/appError";

const allowedOrigins = env.FRONTEND_ORIGINS.split(",").map((origin) => origin.trim());

export const app = express();

app.set("trust proxy", env.TRUST_PROXY_HOPS);

app.use(helmet());
app.use(compression());
app.use(
  cors({
    // Lets in only our frontend sites (every site in development, and requests that send no Origin).
    origin: (origin, callback) => {
      if (!origin || env.NODE_ENV === "development" || allowedOrigins.includes(origin)) return callback(null, true);
      callback(new AppError("Not allowed by CORS", 403));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Gives every request an id, sent back in the X-Request-Id header and written in its log line.
app.use((_req, res, next) => {
  res.locals.requestId = randomUUID();
  res.setHeader("X-Request-Id", res.locals.requestId);
  next();
});
app.use(requestLogger);

app.post(
  "/api/order/webhook",
  rateLimiter({ name: "webhook", seconds: 60, maxRequests: 1000, allowIfRedisDown: true }),
  express.raw({ type: "application/json" }),
  razorpayWebhook,
);

app.use(express.json({ limit: "1mb" }));

app.use("/health", healthRoutes);
app.use(
  "/api",
  rateLimiter({ name: "api", seconds: 60, maxRequests: env.API_RATE_MAX, allowIfRedisDown: true }),
  apiRoutes,
);

// Answers 404 for every URL that no route handled.
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use(errorHandler);
