import { CorsOptions } from "cors";
import { env } from "./env";
import { AppError } from "../utils/appError";

const allowedWebsites = env.FRONTEND_ORIGINS.split(",")
  .map((site) => site.trim())
  .filter(Boolean);

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || env.NODE_ENV === "development" || allowedWebsites.includes(origin)) {
      return callback(null, true);
    }
    return callback(new AppError("Not allowed by CORS", 403));
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
