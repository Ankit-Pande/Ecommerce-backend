import { redis } from "../config/redis";
import { logger } from "../config/winston";

// Cache wrapper — Redis down ho to app NA ruke, cache-miss maan ke DB se kaam chalega.
// NOTE: ye sirf data-cache ke liye hai. Token blacklist/OTP me direct redis hi rahega
// (wo security hai, wahan silent fallback galat hota).
export const cache = {
  // Value lao. Redis down/error -> null (matlab cache miss, DB se laao).
  async get(key: string): Promise<string | null> {
    try {
      return await redis.get(key);
    } catch (err) {
      logger.warn(`Cache get failed [${key}]`, { err });
      return null;
    }
  },

  // Value rakho TTL ke saath. Fail ho to chup-chap aage badho (data DB me safe hai).
  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    try {
      await redis.set(key, value, "EX", ttlSeconds);
    } catch (err) {
      logger.warn(`Cache set failed [${key}]`, { err });
    }
  },

  // Keys hatao (admin update ke baad). Fail ho to TTL khud expire kar dega.
  async del(...keys: string[]): Promise<void> {
    try {
      await redis.del(...keys);
    } catch (err) {
      logger.warn(`Cache del failed [${keys.join(",")}]`, { err });
    }
  },

  // Version counter bump — versioned cache keys (e.g. ai:res:v{N}:...) ek saath
  // invalidate karne ka sasta tareeka: N badla to purani keys use hi nahi hotin
  // (TTL unhe khud saaf kar deta hai). Fail ho to chup — TTL fallback hai hi.
  async bumpVersion(key: string): Promise<void> {
    try {
      await redis.incr(key);
    } catch (err) {
      logger.warn(`Cache version bump failed [${key}]`, { err });
    }
  },
};
