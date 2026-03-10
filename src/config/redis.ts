import Redis from 'ioredis'
import { env } from './env'
import { logger } from './winston'

const globalForRedis = globalThis as { redis?: Redis }

export const redis = globalForRedis.redis ?? new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 200, 2000),
  enableOfflineQueue: false,
  connectTimeout: 5000,
})

if (env.NODE_ENV !== 'production') globalForRedis.redis = redis

redis.on('connect', () => logger.info('✅ Redis connected'))
redis.on('error', (err) => logger.error('❌ Redis error', { err }))

export const disconnectRedis = async () => {
  // ✅ FIX: .disconnect() ki jagah .quit() use kiya
  await redis.quit() 
}