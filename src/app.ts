import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { env } from './config/env'
import { helmetConfig } from './config/helmet'
import { corsOptions } from './config/cors'
import { requestLogger } from './config/morgan'
import { rateLimiter } from './middlewares/Ratelimiter'
import { generateCsrf, verifyCsrf } from './middlewares/Csrf'
import { notFound } from './middlewares/NotFound'
import { errorHandler } from './middlewares/ErrorMid'
import { authRoutes } from './routes/AuthRoutes'
import { userRoutes } from './routes/UserRoutes'
import { adminRoutes } from './routes/AdminRoutes'
import { productRoutes } from './routes/ProductRoutes'
import { cartRoutes } from './routes/CartRoutes'
import { orderRoutes } from './routes/OrderRoutes'
import { homeRoutes } from './routes/HomeRoutes'

export const app = express()

app.set('trust proxy', 1)
app.disable('x-powered-by')

app.use(helmetConfig)
app.use(cors(corsOptions))
app.use(cookieParser(env.COOKIE_SECRET))
app.use(requestLogger)

app.use('/api', rateLimiter({ windowSec: 60, max: 150 }))

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    time: new Date().toISOString(),
  })
})

app.use('/api/v1/orders', orderRoutes)

app.use(express.json({ limit: '10kb' }))
app.use(express.urlencoded({ extended: true, limit: '10kb' }))

app.get('/api/v1/csrf', generateCsrf)

app.use('/api/v1', (req, res, next) => {
  if (!env.CSRF_ENABLED) return next()

  const methods = ['POST', 'PUT', 'PATCH', 'DELETE']
  if (methods.includes(req.method)) {
    return verifyCsrf(req, res, next)
  }

  next()
})

app.use('/api/v1/admin', adminRoutes)
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/users', userRoutes)
app.use('/api/v1/products', productRoutes)
app.use('/api/v1/cart', cartRoutes)
app.use('/api/v1/home', homeRoutes)

app.use(notFound)
app.use(errorHandler)