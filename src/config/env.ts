import "dotenv/config";
import { z } from "zod";

// NODE_ENV na diya ho to production maano, taaki live par galti se dev mode na chale.
const isProd = (process.env.NODE_ENV ?? "production") === "production";

const neededInProd = isProd ? z.string().min(1) : z.string().optional();

// Saari .env values yahin check hoti hain — galat ho to app start hi nahi hogi.
const schema = z
  .object({
    NODE_ENV: z.enum(["development", "production"]).default("production"),
    PORT: z.coerce.number().int().positive().default(8000),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
    API_RATE_MAX: z.coerce.number().int().positive().default(300),

    DATABASE_URL: z.string().url("Invalid DATABASE_URL"),
    DIRECT_URL: z.string().url("Invalid DIRECT_URL"),
    REDIS_URL: z.string().url("Invalid REDIS_URL"),

    FRONTEND_ORIGINS: z.string().min(1, "FRONTEND_ORIGINS is required"),
    SUPER_ADMIN_PHONE: z
      .string()
      .regex(/^[6-9]\d{9}$/)
      .optional(),

    JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 chars"),
    JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 chars"),
    OTP_SECRET: z.string().min(32, "OTP_SECRET must be at least 32 chars"),
    JWT_ACCESS_EXPIRY: z
      .string()
      .regex(/^[1-9]\d*[smhd]$/)
      .default("15m"),

    MSG91_AUTH_KEY: neededInProd,
    MSG91_SENDER_ID: neededInProd,
    MSG91_OTP_TEMPLATE_ID: neededInProd,
    DAILY_SMS_CAP: z.coerce.number().int().positive().default(2000),

    CLOUDINARY_CLOUD_NAME: neededInProd,
    CLOUDINARY_API_KEY: neededInProd,
    CLOUDINARY_API_SECRET: neededInProd,

    RAZORPAY_KEY_ID: neededInProd,
    RAZORPAY_KEY_SECRET: neededInProd,
    RAZORPAY_WEBHOOK_SECRET: neededInProd,
    CHECKOUT_URL: isProd ? z.string().url() : z.string().url().default("http://localhost:3000/checkout"),
    PAYMENT_WINDOW_MINUTES: z.coerce.number().int().min(5).max(1440).default(30),
    MAX_PENDING_ORDERS: z.coerce.number().int().min(1).max(10).default(2),
  })
  .refine(
    (v) => new Set([v.JWT_ACCESS_SECRET, v.JWT_REFRESH_SECRET, v.OTP_SECRET]).size === 3,
    "JWT_ACCESS_SECRET, JWT_REFRESH_SECRET and OTP_SECRET must be different",
  )
  .refine(
    (v) => v.NODE_ENV !== "production" || !/localhost|127\.0\.0\.1/.test(v.FRONTEND_ORIGINS),
    "FRONTEND_ORIGINS cannot point at localhost in production",
  );

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  console.error(parsed.error.flatten());
  process.exit(1);
}

export const env = parsed.data;
