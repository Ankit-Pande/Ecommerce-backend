import 'dotenv/config'
import { z } from 'zod'

const isProd = process.env.NODE_ENV === 'production'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).default(4000),

  DATABASE_URL: z.string().url('Invalid Database URL format'),
  DIRECT_URL: z.string().url('Invalid Direct Database URL format').optional(),
  REDIS_URL: z.string().url('Invalid Redis URL format'),

  FRONTEND_ORIGINS: z.string().min(1, 'Frontend origin is required'),
  GEMINI_API_KEY: z.string().min(1, 'Gemini API key is required'),

  JWT_ACCESS_SECRET: z.string().min(32, 'Access secret must be at least 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'Refresh secret must be at least 32 chars'),
  COOKIE_SECRET: z.string().min(16, 'Cookie secret must be at least 16 chars'),

  CSRF_ENABLED: z.coerce.boolean().default(true),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  CLOUDINARY_CLOUD_NAME: isProd ? z.string().min(1) : z.string().optional(),
  CLOUDINARY_API_KEY: isProd ? z.string().min(1) : z.string().optional(),
  CLOUDINARY_API_SECRET: isProd ? z.string().min(1) : z.string().optional(),

  TWILIO_ACCOUNT_SID: isProd ? z.string().min(1) : z.string().optional(),
  TWILIO_AUTH_TOKEN: isProd ? z.string().min(1) : z.string().optional(),
  TWILIO_PHONE_NUMBER: isProd ? z.string().min(1) : z.string().optional(),

  RAZORPAY_KEY_ID: isProd ? z.string().min(1) : z.string().optional(),
  RAZORPAY_KEY_SECRET: isProd ? z.string().min(1) : z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: isProd ? z.string().min(1) : z.string().optional(),

  WEBHOOK_SECRET: z.string().optional(),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data