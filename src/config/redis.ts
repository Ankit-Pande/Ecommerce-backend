import Redis from "ioredis";
import { env } from "./env";
import { logger } from "./winston";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 2,
  retryStrategy: (times) => Math.min(times * 200, 2000),
  // Redis down ho to command turant fail ho, request latke nahi.
  enableOfflineQueue: false,
  connectTimeout: 5000,
  commandTimeout: 1000,
});

redis.on("connect", () => logger.info("Redis connected"));
redis.on("error", (error) => logger.error("Redis error", { error }));

// Server band hote waqt Redis connection band.
export async function disconnectRedis(): Promise<void> {
  if (redis.status === "end") return;
  await redis.quit().catch((error) => {
    logger.error("Redis disconnect failed", { error });
  });
}

// Rate limit ki ginti +1 karo, pehli baar par expiry lagao (ek hi step me).
const HIT_SCRIPT = `
local n = redis.call('INCR', KEYS[1])
if redis.call('TTL', KEYS[1]) < 0 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return n`;

export async function countHit(key: string, windowSec: number): Promise<number> {
  return Number(await redis.eval(HIT_SCRIPT, 1, key, windowSec));
}
