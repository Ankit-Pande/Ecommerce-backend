import { redis } from "./redis";

export const CACHE_SECONDS = 300;
const VERSION_KEY = "storefront:version";
const LOCK_SECONDS = 10;
const WAIT_MS = 200;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Pehle Redis me dekho, na mile to DB se lao aur Redis me save karo (Redis down ho to seedha DB).
export async function remember<T>(name: string, ttlSec: number, build: () => Promise<T>): Promise<T> {
  const version = await redis.get(VERSION_KEY).catch(() => undefined);
  if (version === undefined) return build();

  const key = `storefront:${version ?? "0"}:${name}`;
  const cached = await redis.get(key).catch(() => null);
  if (cached) return JSON.parse(cached) as T;

  // Ek saath hazaar request aayein to sirf ek DB jaaye, baaki thoda ruk kar cache dekhein.
  const gotLock = await redis.set(`${key}:lock`, "1", "EX", LOCK_SECONDS, "NX").catch(() => null);
  if (!gotLock) {
    await wait(WAIT_MS);
    const retry = await redis.get(key).catch(() => null);
    if (retry) return JSON.parse(retry) as T;
  }

  const result = await build();
  await redis.set(key, JSON.stringify(result), "EX", ttlSec).catch(() => null);
  return result;
}

// Admin ne kuch badla — version badhao, poora public cache apne aap naya.
export async function bumpStorefrontCache(): Promise<void> {
  await redis.incr(VERSION_KEY).catch(() => null);
}
