import { RequestHandler } from 'express'
import { redis } from '../config/redis'
import { AppError } from '../utils/AppError'
import { logger } from '../config/winston'

interface Options {
  windowSec: number
  max: number
}

export const rateLimiter = (options: Options): RequestHandler => {
  return async (req, _res, next) => {
    try {
      const clientId = req.user?.userId || req.ip || 'unknown'

      const key = `rate:${clientId}:${req.baseUrl}${req.path}`

      const requestCount = await redis.incr(key)

      if (requestCount === 1) {
        await redis.expire(key, options.windowSec)
      }

      if (requestCount > options.max) {
        return next(
          new AppError('Too many requests, please try again later.', 429)
        )
      }

      next()

    } catch (error) {
      logger.error('Rate limiter error', { error })
      next()
    }
  }
}