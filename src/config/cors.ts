import { CorsOptions } from "cors";
import { env } from "./env";
import { AppError } from "../utils/appError";

const allowedOrigins = env.FRONTEND_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Frontend alag domain pe hai aur refresh cookie cross-site jaati hai, isliye
// whitelist hi CSRF se bachaati hai: galat origin ki request controller tak pahunchti hi nahi.
export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Postman / server-to-server / Android me origin hota hi nahi.
    if (!origin) return callback(null, true);
    if (env.NODE_ENV === "development") return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new AppError("Not allowed by CORS", 403));
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
