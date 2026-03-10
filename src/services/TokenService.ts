import { redis } from '../config/redis'
import { AppError } from '../utils/AppError'
import { Role } from '@prisma/client'
import { asyncHandler } from '../utils/AsyncHandler'
import { signAccessToken, signRefreshToken, generateJti, verifyRefreshToken } from '../utils/Token'

const REFRESH_TTL = 7 * 24 * 60 * 60 // 7 days
const ACCESS_TTL = 15 * 60           // 15 mins

const refreshKey = (u: string, j: string) => `refresh:${u}:${j}`
const sessionKey = (u: string) => `user_sessions:${u}`
const blacklistKey = (j: string) => `access_blacklist:${j}`

export const tokenService = {
  async createSession(userId: string, role: Role) {
    const jti = generateJti()

    const accessToken = signAccessToken({ userId, role, jti })
    const refreshToken = signRefreshToken({ userId, role, jti })

    const pipe = redis.pipeline()
    pipe.set(refreshKey(userId, jti), '1', 'EX', REFRESH_TTL)
    pipe.sadd(sessionKey(userId), jti)
    pipe.expire(sessionKey(userId), REFRESH_TTL)
    await pipe.exec()

    return { accessToken, refreshToken }
  },

async refreshSession(token: string) {
    const payload = verifyRefreshToken(token)
    if (!payload) throw new AppError('Invalid refresh token', 401)

    const exists = await redis.get(refreshKey(payload.userId, payload.jti))
    if (!exists) throw new AppError('Session expired', 401)

    const lockKey = `lock:${payload.userId}:${payload.jti}`
    const locked = await redis.set(lockKey, '1', 'EX', 5, 'NX')
    if (!locked) throw new AppError('Duplicate refresh request', 409)

    const pipe = redis.pipeline()
    pipe.del(refreshKey(payload.userId, payload.jti))
    pipe.srem(sessionKey(payload.userId), payload.jti)
    pipe.set(blacklistKey(payload.jti), '1', 'EX', ACCESS_TTL)
    
    // IMPROVED: Kaam hote hi lock turant khol diya
    pipe.del(lockKey) 
    await pipe.exec()

    return this.createSession(payload.userId, payload.role)
  },

  async revokeSession(userId: string, jti: string) {
    const pipe = redis.pipeline()
    pipe.del(refreshKey(userId, jti))
    pipe.srem(sessionKey(userId), jti)
    pipe.set(blacklistKey(jti), '1', 'EX', ACCESS_TTL)
    await pipe.exec()
  },

  async revokeAllSessions(userId: string) {
    const sessions = await redis.smembers(sessionKey(userId))
    if (!sessions.length) return

    const pipe = redis.pipeline()
    sessions.forEach((jti) => {
      pipe.del(refreshKey(userId, jti))
      pipe.set(blacklistKey(jti), '1', 'EX', ACCESS_TTL)
    })
    pipe.del(sessionKey(userId))
    await pipe.exec()
  },

  async isAccessBlacklisted(jti: string) {
    return redis.get(blacklistKey(jti))
  },
}