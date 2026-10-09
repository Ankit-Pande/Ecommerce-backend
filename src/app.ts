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

const keepRawBodyForSignature = express.raw({ type: "application/json" });

app.set("trust proxy", env.TRUST_PROXY_HOPS);

app.use(helmet());
app.use(cors(corsOptions));
app.use(requestLogger);

app.post(
  "/api/order/webhook",
  rateLimiter({ name: "webhook", seconds: 60, maxRequests: 300, allowIfRedisDown: true }),
  keepRawBodyForSignature,
  razorpayWebhook,
);

app.use(express.json({ limit: "1mb" }));

app.use("/health", healthRoutes);

app.use(
  "/api",
  rateLimiter({ name: "api", seconds: 60, maxRequests: env.API_RATE_MAX, allowIfRedisDown: true }),
  apiRoutes,
);

app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use(errorHandler);
