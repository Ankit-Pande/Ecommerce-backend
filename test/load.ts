import { randomUUID } from "crypto";
import { prisma } from "../src/config/db";
import { env } from "../src/config/env";
import { redis } from "../src/config/redis";
import { tokenService } from "../src/service/token.service";
import { call, CallOptions, Reply, startServer, wait } from "./helpers";

const SHOPPERS = Number(process.argv[2] ?? 1000);
const SECONDS = Number(process.argv[3] ?? 120);
const POPULAR_SEARCHES = [
  "shoes",
  "lal juta 3000 tak",
  "samsung phone",
  "jeans",
  "kurta",
  "headphones under 2000",
  "laptop",
  "saree",
  "smart watch",
  "tshirt",
];
const QUESTIONS = ["running shoes under 3000", "lal kurta dikhao", "samsung phone", "mera cart dikhao", "mere orders"];
const SORTS = ["latest", "price_asc", "price_desc", "rating", "discount"];
const ADDRESS = {
  fullName: "Load Shopper",
  line1: "1 Test Street",
  city: "New Delhi",
  state: "Delhi",
  pincode: "110001",
};

type Shopper = { token: string; addressId: string };
type Card = { id: string; slug: string; stockStatus: string };

const resultsByApi = new Map<string, { times: number[]; answers: Map<number, number> }>();

// A random item of the list.
function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

// Waits 5 to 15 seconds, like a shopper reading the page; returns false when the test time is over.
async function readPage(endAt: number) {
  await wait(5000 + Math.random() * 10000);
  return Date.now() < endAt;
}

// Calls one API and keeps its time and answer code under `name` (answer 0 = the server did not answer).
async function measure(name: string, method: string, path: string, options: CallOptions): Promise<Reply> {
  const started = performance.now();
  const reply = await call(method, path, options).catch(() => ({
    status: 0,
    json: {},
    ms: Math.round(performance.now() - started),
    cookie: "",
  }));
  const result = resultsByApi.get(name) ?? { times: [], answers: new Map<number, number>() };
  result.times.push(reply.ms);
  result.answers.set(reply.status, (result.answers.get(reply.status) ?? 0) + 1);
  resultsByApi.set(name, result);
  return reply;
}

// Makes test shopper number `index` (phone 6000000000 + index) with an address and logs it in (a session, no OTP).
async function makeShopper(index: number): Promise<Shopper> {
  const phone = String(6000000000 + index);
  const user = await prisma.user.upsert({ where: { phone }, create: { phone, name: "Load Shopper" }, update: {} });
  const address =
    (await prisma.address.findFirst({ where: { userId: user.id } })) ??
    (await prisma.address.create({ data: { ...ADDRESS, phone, userId: user.id, isDefault: true } }));
  const { accessToken } = await tokenService.createSession(user.id);
  return { token: accessToken, addressId: address.id };
}

// One shopper shops until the end time: home, category, search, product, cart, an order or not, a question, my orders.
async function shop(shopper: Shopper, categories: string[], productWords: string[], endAt: number) {
  const as = { token: shopper.token };
  await wait(Math.random() * 5000);
  for (;;) {
    await measure("GET /api/home", "GET", "/api/home", as);
    if (!(await readPage(endAt))) return;

    const browsePath = `/api/catalog?category=${pick(categories)}&sort=${pick(SORTS)}&limit=24`;
    const browse = await measure("GET /api/catalog (category)", "GET", browsePath, as);
    if (!(await readPage(endAt))) return;

    const words = Math.random() < 0.5 ? pick(POPULAR_SEARCHES) : pick(productWords);
    const searchPath = `/api/catalog?q=${encodeURIComponent(words)}&limit=24`;
    const search = await measure("GET /api/catalog?q= (search)", "GET", searchPath, as);
    if (!(await readPage(endAt))) return;

    const shown: Card[] = [...(search.json.items ?? []), ...(browse.json.items ?? [])];
    const cards = shown.filter((card) => card.stockStatus !== "OUT_OF_STOCK");
    if (cards.length === 0) continue;
    const card = pick(cards);
    const page = await measure("GET /api/products/:slug", "GET", `/api/products/${card.slug}`, as);
    await measure("GET /api/products/:slug/reviews", "GET", `/api/products/${card.slug}/reviews`, as);
    if (!(await readPage(endAt))) return;

    const { sizes = [], colors = [] } = page.json.data ?? {};
    const item = { productId: card.id, quantity: 1, size: sizes[0], color: colors[0] };
    const cart = await measure("POST /api/cart", "POST", "/api/cart", { ...as, body: item });
    if (!(await readPage(endAt))) return;

    if (Math.random() < 0.2) {
      const body = { idempotencyKey: randomUUID(), addressId: shopper.addressId, paymentMethod: "COD" };
      const order = await measure("POST /api/order/checkout (COD)", "POST", "/api/order/checkout", { ...as, body });
      const orderId = order.json.data?.orderId;
      if (orderId) await measure("PATCH /api/order/:id/cancel", "PATCH", `/api/order/${orderId}/cancel`, as);
    } else {
      for (const line of cart.json.data?.items ?? []) {
        await measure("DELETE /api/cart/:id", "DELETE", `/api/cart/${line.id}`, as);
      }
    }
    if (Math.random() < 1 / 3) {
      const messages = [{ role: "user", content: pick(QUESTIONS) }];
      await measure("POST /api/assistant/chat", "POST", "/api/assistant/chat", { ...as, body: { messages } });
    }
    await measure("GET /api/order", "GET", "/api/order", as);
    if (!(await readPage(endAt))) return;
  }
}

// The time within which the given share of a sorted list of times finished (0.95 = 95% of calls).
function within(sortedTimes: number[], share: number) {
  return sortedTimes[Math.min(sortedTimes.length - 1, Math.floor(sortedTimes.length * share))];
}

// Prints a table of every API (calls, times, answer codes) and the totals; returns the errors and the 95% time.
function printReport() {
  const table = [...resultsByApi].map(([name, { times, answers }]) => {
    times.sort((a, b) => a - b);
    const answerText = [...answers].map(([status, calls]) => `${status || "no answer"} ×${calls}`).join(", ");
    const row = {
      calls: times.length,
      "50% in ms": within(times, 0.5),
      "95% in ms": within(times, 0.95),
      "slowest ms": times[times.length - 1],
      answers: answerText,
    };
    return [name, row];
  });
  console.table(Object.fromEntries(table));

  const allTimes = [...resultsByApi.values()].flatMap((result) => result.times).sort((a, b) => a - b);
  const errors = [...resultsByApi.values()]
    .flatMap((result) => [...result.answers])
    .filter(([status]) => status === 0 || status >= 500)
    .reduce((sum, [, calls]) => sum + calls, 0);
  const slow95 = within(allTimes, 0.95);
  console.log(`Total: ${allTimes.length} calls in ${SECONDS} s = ${Math.round(allTimes.length / SECONDS)} a second`);
  console.log(`Errors (5xx or no answer): ${errors}. 95% of all calls within ${slow95} ms`);
  return { errors, slow95 };
}

// Usage: npm run test:load -- <shoppers> <seconds> (default 1000 for 120): logged-in shoppers shop at the same time.
async function main() {
  if (env.NODE_ENV !== "development") throw new Error("Run tests only with NODE_ENV=development (they add test data)");
  if (SECONDS > 840) throw new Error("At most 840 seconds: a login token lasts 15 minutes");
  if (redis.status !== "ready") await new Promise((resolve) => redis.once("ready", resolve));
  const server = await startServer("warn");
  await prisma.session.deleteMany({ where: { user: { phone: { startsWith: "60000" } } } });
  const shoppers: Shopper[] = [];
  for (let index = 0; index < SHOPPERS; index += 100) {
    const batch = Array.from({ length: Math.min(100, SHOPPERS - index) }, (_, offset) => makeShopper(index + offset));
    shoppers.push(...(await Promise.all(batch)));
  }
  const categories = await prisma.category.findMany({ where: { isActive: true }, select: { slug: true } });
  const names = await prisma.$queryRaw<{ name: string }[]>`
    SELECT "name" FROM "Product" WHERE "isActive" ORDER BY random() LIMIT 1000`;
  const productWords = names.map(({ name }) => name.split(" ").slice(0, 2).join(" "));
  const products = await prisma.product.count({ where: { isActive: true } });
  console.log(`${SHOPPERS} shoppers logged in, ${products} products in the store. Shopping for ${SECONDS} s...`);

  const endAt = Date.now() + SECONDS * 1000;
  const categorySlugs = categories.map((category) => category.slug);
  await Promise.all(shoppers.map((shopper) => shop(shopper, categorySlugs, productWords, endAt)));
  const { errors, slow95 } = printReport();
  const redisMemory = (await redis.info("memory")).match(/used_memory_human:(\S+)/)?.[1];
  console.log(`Redis: ${redisMemory} used, ${await redis.dbsize()} keys`);
  if (errors > 0) console.log("FAIL: some calls got a server error or no answer");
  else if (slow95 >= 1000) console.log("FAIL: no errors, but too slow (95% of calls took over 1 second)");
  else console.log("PASS: no errors, 95% of calls within 1 second");
  server.kill();
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(errors === 0 && slow95 < 1000 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
