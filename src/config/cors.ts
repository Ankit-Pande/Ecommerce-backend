import { CorsOptions } from "cors";
import { env } from "./env";
import { AppError } from "../utils/appError";

const allowedOrigins = env.FRONTEND_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Sirf apni website (FRONTEND_ORIGINS) API bula sake — CSRF se bhi yahi bachata hai.
export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (env.NODE_ENV === "development") return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new AppError("Not allowed by CORS", 403));
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
