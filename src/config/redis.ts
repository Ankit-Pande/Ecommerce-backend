import Redis from "ioredis";
import { env } from "./env";
import { logger } from "./winston";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 2,
  retryStrategy: (times) => Math.min(times * 200, 2000),
  enableOfflineQueue: false,
  connectTimeout: 5000,
  commandTimeout: 1000,
});

redis.on("connect", () => logger.info("Redis connected"));
redis.on("error", (error) => logger.error("Redis error", { error }));

// Server band hote waqt Redis connection band karo.
export async function disconnectRedis(): Promise<void> {
  if (redis.status === "end") return;
  await redis.quit().catch((error) => logger.error("Redis disconnect failed", { error }));
}

const COUNT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if redis.call('TTL', KEYS[1]) < 0 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return count`;

// Is key ki ginti +1 karke nayi ginti do; "seconds" poore hone par ginti fir 0 se.
export async function countInWindow(key: string, seconds: number): Promise<number> {
  return Number(await redis.eval(COUNT_SCRIPT, 1, key, seconds));
}
