import { RequestHandler } from 'express'
import { redis } from '../config/redis'
import { AppError } from '../utils/AppError'
import { asyncHandler } from '../utils/AsyncHandler'

export const blockCheck: RequestHandler = asyncHandler(async (req, _res, next) => {
  
  // User login hona chahiye
  if (!req.user) {
    throw new AppError('Unauthorized', 401)
  }

  // Redis me check karo user blocked hai ya nahi
  const key = `user:${req.user.userId}:blocked`
  const isBlocked = await redis.get(key)

  if (isBlocked === '1') {
    throw new AppError('Account blocked by admin', 403)
  }

  next()
})