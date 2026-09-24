import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { corsOptions } from "./config/cors";
import { helmetConfig } from "./config/helmet";
import { requestLogger } from "./config/morgan";
import { razorpayWebhook } from "./controller/order.controller";
import { errorHandler } from "./middleware/error";
import { rateLimiter } from "./middleware/rateLimiter";
import { apiRoutes } from "./routes";
import { healthRoutes } from "./routes/health.routes";

export const app = express();

// Proxy (Railway) ke peeche — iske bina req.ip sabke liye proxy ka IP hota aur rate limit sab pe ek saath lagti.
app.set("trust proxy", env.TRUST_PROXY_HOPS);

app.use(helmetConfig);
app.use(cors(corsOptions));
app.use(requestLogger);

// Razorpay webhook JSON parser se PEHLE — signature raw body pe check hota hai.
// Ye route /api wali limit se pehle lagta hai, isliye apni limit chahiye. Razorpay itna
// kabhi nahi bhejta — ye sirf flood rokne ke liye hai.
app.post(
  "/api/order/webhook",
  rateLimiter({ bucket: "webhook", windowSec: 60, max: 300, allowOnRedisDown: true }),
  express.raw({ type: "application/json" }),
  razorpayWebhook,
);

app.use(express.json({ limit: "1mb" }));

app.use("/health", healthRoutes);

// Poori API pe ek IP ki limit (route wali limits iske alawa).
app.use(
  "/api",
  rateLimiter({ bucket: "api", windowSec: 60, max: env.API_RATE_MAX, allowOnRedisDown: true }),
  apiRoutes,
);

app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use(errorHandler);
