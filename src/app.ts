import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import { corsOptions } from "./config/cors";
import { requestLogger } from "./config/morgan";
import { razorpayWebhook } from "./controller/order.controller";
import { errorHandler } from "./middleware/error";
import { rateLimiter } from "./middleware/rateLimiter";
import { apiRoutes } from "./routes";
import { healthRoutes } from "./routes/health.routes";

export const app = express();

// Railway proxy ke peeche asli user IP mile (rate limit isi par chalti hai).
app.set("trust proxy", env.TRUST_PROXY_HOPS);

app.use(helmet());
app.use(cors(corsOptions));
app.use(requestLogger);

// Webhook express.json() se PEHLE — signature raw body par check hota hai.
app.post(
  "/api/order/webhook",
  rateLimiter({ bucket: "webhook", windowSec: 60, max: 300, allowOnRedisDown: true }),
  express.raw({ type: "application/json" }),
  razorpayWebhook,
);

app.use(express.json({ limit: "1mb" }));

app.use("/health", healthRoutes);

// Poori API par ek IP ki limit.
app.use(
  "/api",
  rateLimiter({ bucket: "api", windowSec: 60, max: env.API_RATE_MAX, allowOnRedisDown: true }),
  apiRoutes,
);

app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use(errorHandler);
