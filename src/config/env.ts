import "dotenv/config";
import { z } from "zod";

const isProd = process.env.NODE_ENV === "production";

// Saari env ek jagah validate. Galat/missing pe app start hi nahi hoga (fail-fast).
// Third-party keys (MSG91/Razorpay/Cloudinary) dev me optional, prod me must.
const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8000),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  DATABASE_URL: z.string().url("Invalid Database URL format"),
  DIRECT_URL: z.string().url("Invalid Direct Database URL format").optional(),
  REDIS_URL: z.string().url("Invalid Redis URL format"),

  FRONTEND_ORIGINS: z.string().min(1, "Frontend origin is required"),

  // Pehla super admin (seed script isi number ko SUPER_ADMIN banata hai).
  SUPER_ADMIN_PHONE: z.string().optional(),

  // JWT — header-based auth (web + Android same). Koi cookie/CSRF nahi.
  JWT_ACCESS_SECRET: z.string().min(32, "Access secret must be at least 32 chars"),
  JWT_REFRESH_SECRET: z.string().min(32, "Refresh secret must be at least 32 chars"),
  JWT_ACCESS_EXPIRY: z.string().default("15m"),
  JWT_REFRESH_EXPIRY: z.string().default("30d"),

  // MSG91 — OTP SMS (India standard).
  MSG91_AUTH_KEY: isProd ? z.string().min(1) : z.string().optional(),
  MSG91_SENDER_ID: isProd ? z.string().min(1) : z.string().optional(),
  MSG91_OTP_TEMPLATE_ID: isProd ? z.string().min(1) : z.string().optional(),

  // Cloudinary — product/category/banner images.
  CLOUDINARY_CLOUD_NAME: isProd ? z.string().min(1) : z.string().optional(),
  CLOUDINARY_API_KEY: isProd ? z.string().min(1) : z.string().optional(),
  CLOUDINARY_API_SECRET: isProd ? z.string().min(1) : z.string().optional(),

  // Gemini — AI assistant (embeddings + chat). Optional: key nahi to lite mode
  // (full-text search + template replies chalte hain, semantic/LLM skip).
  GEMINI_API_KEY: z.string().optional(),

  // Razorpay — order payment.
  RAZORPAY_KEY_ID: isProd ? z.string().min(1) : z.string().optional(),
  RAZORPAY_KEY_SECRET: isProd ? z.string().min(1) : z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: isProd ? z.string().min(1) : z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
