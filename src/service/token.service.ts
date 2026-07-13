import { Role } from "@prisma/client";
import { redis } from "../config/redis";
import { env } from "../config/env";
import { AppError } from "../utils/appError";
import {
  generateJti,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/token";

// JWT expiry strings (env: "15m","30d") ko redis TTL (seconds) me convert.
// JWT khud expiry handle karta hai; redis TTL bas usse match kare taaki keys saath expire ho.
const toSeconds = (exp: string): number => {
  const m = exp.match(/^(\d+)([smhd])$/);
  if (!m) return 0;
  const n = Number(m[1]);
  const unit = m[2];
  return unit === "s" ? n : unit === "m" ? n * 60 : unit === "h" ? n * 3600 : n * 86400;
};

const ACCESS_TTL = toSeconds(env.JWT_ACCESS_EXPIRY);
const REFRESH_TTL = toSeconds(env.JWT_REFRESH_EXPIRY);

const refreshKey = (userId: string, jti: string) => `refresh:${userId}:${jti}`;
const sessionKey = (userId: string) => `user_sessions:${userId}`;
const blacklistKey = (jti: string) => `access_blacklist:${jti}`;
const lockKey = (userId: string, jti: string) => `lock:${userId}:${jti}`;

export const tokenService = {
  // Login pe naya access + refresh. Refresh redis me track (rotate/revoke ke liye).
  async createSession(userId: string, role: Role) {
    const jti = generateJti();
    const accessToken = signAccessToken({ userId, role, jti });
    const refreshToken = signRefreshToken({ userId, role, jti });

    const pipeline = redis.pipeline();
    pipeline.set(refreshKey(userId, jti), "1", "EX", REFRESH_TTL);
    pipeline.sadd(sessionKey(userId), jti);
    pipeline.expire(sessionKey(userId), REFRESH_TTL);
    await pipeline.exec();

    return { accessToken, refreshToken };
  },

  // Refresh -> rotate (purana invalidate, naya issue). Lock se double-use rok.
  async refreshSession(token: string) {
    const payload = verifyRefreshToken(token);

    const exists = await redis.get(refreshKey(payload.userId, payload.jti));
    if (!exists) throw new AppError("Session expired", 401);

    // 5s lock — same refresh token se parallel 2 request aaye to ek hi chale.
    const locked = await redis.set(
      lockKey(payload.userId, payload.jti),
      "1",
      "EX",
      5,
      "NX"
    );
    if (!locked) throw new AppError("Duplicate refresh request", 409);

    try {
      const pipeline = redis.pipeline();
      pipeline.del(refreshKey(payload.userId, payload.jti));
      pipeline.srem(sessionKey(payload.userId), payload.jti);
      pipeline.set(blacklistKey(payload.jti), "1", "EX", ACCESS_TTL);
      await pipeline.exec();

      return await this.createSession(payload.userId, payload.role);
    } finally {
      await redis.del(lockKey(payload.userId, payload.jti));
    }
  },

  // Logout (single device).
  async revokeSession(userId: string, jti: string): Promise<void> {
    const pipeline = redis.pipeline();
    pipeline.del(refreshKey(userId, jti));
    pipeline.srem(sessionKey(userId), jti);
    pipeline.set(blacklistKey(jti), "1", "EX", ACCESS_TTL);
    await pipeline.exec();
  },

  // authCheck ye call karta hai — access token revoked hai ya nahi.
  async isAccessBlacklisted(jti: string): Promise<boolean> {
    return (await redis.get(blacklistKey(jti))) === "1";
  },
};
