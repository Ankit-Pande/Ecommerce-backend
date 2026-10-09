import { redis } from "./redis";

export const CACHE_SECONDS = 300;

const VERSION_KEY = "storefront:version";
const LOCK_SECONDS = 10;
const WAIT_MS = 200;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Pehle Redis me dekho; na mile to DB se lao aur Redis me rakh do. Redis band ho to seedha DB.
export async function getOrSetCache<T>(name: string, seconds: number, loadFromDb: () => Promise<T>): Promise<T> {
  const version = await redis.get(VERSION_KEY).catch(() => undefined);
  if (version === undefined) return loadFromDb();

  const key = `storefront:${version ?? "0"}:${name}`;
  const saved = await redis.get(key).catch(() => null);
  if (saved) return JSON.parse(saved) as T;

  const isFirst = await redis.set(`${key}:lock`, "1", "EX", LOCK_SECONDS, "NX").catch(() => null);
  if (!isFirst) {
    await sleep(WAIT_MS);
    const savedNow = await redis.get(key).catch(() => null);
    if (savedNow) return JSON.parse(savedNow) as T;
  }

  const data = await loadFromDb();
  await redis.set(key, JSON.stringify(data), "EX", seconds).catch(() => null);
  return data;
}

// Admin ne kuch badla: version badhao, purana saara cache apne aap bekaar ho jata hai.
export async function clearStoreCache(): Promise<void> {
  await redis.incr(VERSION_KEY).catch(() => null);
}
