import { CorsOptions } from "cors";
import { env } from "./env";

// Allowed origins env se (comma separated). filter(Boolean) trailing comma/empty hata deta hai.
const allowedOrigins = env.FRONTEND_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Android app / Postman / server-to-server me origin hota hi nahi -> allow.
    if (!origin) return callback(null, true);

    // Dev me sab allow (local testing aasan).
    if (env.NODE_ENV === "development") return callback(null, true);

    // Prod me sirf whitelist (web frontend).
    if (allowedOrigins.includes(origin)) return callback(null, true);

    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
