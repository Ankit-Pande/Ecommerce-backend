import Redis from "ioredis";
import { env } from "./env";
import { logger } from "./winston";

const CACHE_SECONDS = 300;
const CACHE_VERSION_KEY = "cache:version";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 2,
  retryStrategy: (times) => Math.min(times * 200, 2000),
  enableOfflineQueue: false,
  connectTimeout: 5000,
  commandTimeout: 1000,
});

redis.on("connect", () => logger.info("Redis connected"));
redis.on("error", (error) => logger.error("Redis error", { error }));

const COUNT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if redis.call('TTL', KEYS[1]) < 0 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return count`;

export async function countInWindow(key: string, seconds: number): Promise<number> {
  return Number(await redis.eval(COUNT_SCRIPT, 1, key, seconds));
}

export async function getOrSetCache<T>(name: string, loadFromDb: () => Promise<T>): Promise<T> {
  const version = await redis.get(CACHE_VERSION_KEY).catch(() => undefined);
  if (version === undefined) return loadFromDb();

  const key = `cache:${version ?? 0}:${name}`;
  const saved = await redis.get(key).catch(() => null);
  if (saved) return JSON.parse(saved) as T;

  const data = await loadFromDb();
  await redis.set(key, JSON.stringify(data), "EX", CACHE_SECONDS).catch(() => null);
  return data;
}

export async function clearCache() {
  await redis.incr(CACHE_VERSION_KEY).catch(() => null);
}
