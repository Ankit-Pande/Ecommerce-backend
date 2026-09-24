import { redis } from "./redis";

export const CACHE_SECONDS = 300;
const VERSION_KEY = "storefront:version";
// Ek build itni der se zyada nahi lagti; lock isse zyada der atka nahi rahega.
const LOCK_SECONDS = 10;
const WAIT_MS = 200;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Public data (home, catalog, product) ka cache. Key me version juda hai — admin kuch
// bhi badle to version badhta hai aur purani saari keys apne aap bekaar ho jaati hain.
// Redis down ho to seedha DB se — page kabhi band nahi hota.
export async function remember<T>(name: string, ttlSec: number, build: () => Promise<T>): Promise<T> {
  const version = await redis.get(VERSION_KEY).catch(() => undefined);
  if (version === undefined) return build();

  const key = `storefront:${version ?? "0"}:${name}`;
  const cached = await redis.get(key).catch(() => null);
  if (cached) return JSON.parse(cached) as T;

  // Cache khatam hone ke us ek second me hazaar request aa sakti hain. Lock sirf ek ko
  // milta hai — wahi DB jaata hai, baaki thoda ruk kar dobara cache dekh lete hain.
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

// Product/category/brand/banner/stock/price kuch bhi badla — poora public cache naya.
export async function bumpStorefrontCache(): Promise<void> {
  await redis.incr(VERSION_KEY).catch(() => null);
}
