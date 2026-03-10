import { CorsOptions } from 'cors'
import { env } from './env'

const allowedOrigins = env.FRONTEND_ORIGINS.split(',').map((o) => o.trim())

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    if (env.NODE_ENV === 'development') return callback(null, true)
    if (allowedOrigins.includes(origin)) return callback(null, true)

    callback(new Error('Not allowed by CORS'))
  },
  credentials: true,
}