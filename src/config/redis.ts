import Redis from "ioredis";
import { env } from "./env";
import { logger } from "./winston";

// Single Redis client. SIRF OTP store + rate-limit ke liye.
// User block status DB me hai (source of truth) — redis pe nahi, is scale pe wahi sahi.
const globalForRedis = globalThis as unknown as {
  redis?: Redis;
};

export const redis =
  globalForRedis.redis ??
  new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 200, 2000),
    enableOfflineQueue: false, // redis down -> request turant fail, hang nahi
    connectTimeout: 5000,
  });

if (env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

redis.on("connect", () => {
  logger.info("Redis connected");
});

redis.on("error", (error) => {
  logger.error("Redis error", { error });
});

// Graceful shutdown pe call (server.ts).
export async function disconnectRedis(): Promise<void> {
  try {
    if (redis.status === "end") return;
    await redis.quit();
    logger.info("Redis disconnected");
  } catch (error) {
    logger.error("Redis disconnect failed", { error });
  }
}
