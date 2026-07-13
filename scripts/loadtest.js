/*
 * Load test — deploy se pehle backend capacity check.
 * Pure Node (koi dependency nahi). Virtual users concurrent GET loop chalate hain
 * real traffic jaise mix pe: home 40%, product list 30%, search 20%, category 10%.
 *
 * Usage:
 *   node scripts/loadtest.js --c 200 --d 15        (200 concurrent users, 15 sec)
 *   node scripts/loadtest.js --c 500 --d 20 --host http://localhost:5000
 *
 * Reading:
 *   RPS x 60 = requests/min. Ek active user ~1 request / 5-10 sec karta hai,
 *   to 1000 RPS ≈ 5,000-10,000 LIVE concurrent users ≈ 50k-100k daily users se zyada.
 */
const http = require("http");
const https = require("https");
const { URL } = require("url");

// ---- args ----
const args = process.argv.slice(2);
const getArg = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const HOST = getArg("host", "http://localhost:5000");
const CONCURRENCY = parseInt(getArg("c", "100"), 10);
const DURATION_S = parseInt(getArg("d", "15"), 10);
// --dbheavy: har request unique random filters ke saath -> Redis cache miss -> pura load
// seedha DB pe. Worst-case DB capacity napne ke liye (real traffic isse halka hota hai).
const DB_HEAVY = args.includes("--dbheavy");

// Real traffic jaisa URL mix (weight ke hisaab se random pick).
const ROUTES = [
  { path: "/api/home", weight: 40 },
  { path: "/api/product?limit=20", weight: 15 },
  { path: "/api/product?limit=20&sort=price_asc", weight: 15 },
  { path: "/api/product?q=samsung&limit=20", weight: 10 },
  { path: "/api/product?q=shoes+under+5000&limit=20", weight: 10 },
  { path: "/api/category", weight: 10 },
];
const SORTS = ["newest", "price_asc", "price_desc"];
const DB_TERMS = ["classic", "premium", "smart", "ultra", "watch", "bag", "shirt", "speaker"];
let dbCategories = []; // dbheavy mode me startup pe bhar jaata hai

const pickRoute = () => {
  if (DB_HEAVY) {
    // Random min/max price har request pe alag -> cache key alag -> DB hit guaranteed.
    const min = Math.floor(Math.random() * 5000);
    const sort = SORTS[Math.floor(Math.random() * SORTS.length)];
    const r = Math.random();
    if (r < 0.4 && dbCategories.length) {
      const cat = dbCategories[Math.floor(Math.random() * dbCategories.length)];
      return `/api/product?categoryId=${cat}&minPrice=${min}&sort=${sort}&limit=20`;
    }
    if (r < 0.7) {
      const term = DB_TERMS[Math.floor(Math.random() * DB_TERMS.length)];
      return `/api/product?q=${term}&minPrice=${min}&limit=20`;
    }
    return `/api/product?minPrice=${min}&sort=${sort}&limit=20`;
  }
  let r = Math.random() * 100;
  for (const route of ROUTES) {
    if ((r -= route.weight) <= 0) return route.path;
  }
  return ROUTES[0].path;
};

const base = new URL(HOST);
const isHttps = base.protocol === "https:";
const lib = isHttps ? https : http;
const agent = new (isHttps ? https.Agent : http.Agent)({
  keepAlive: true,
  maxSockets: CONCURRENCY,
});

// ---- metrics ----
let done = 0;
let errors = 0;
const statusCounts = {};
const latencies = []; // ms

function hit() {
  return new Promise((resolve) => {
    const path = pickRoute();
    const t0 = process.hrtime.bigint();
    const req = lib.get(
      { host: base.hostname, port: base.port, path, agent, timeout: 30000 },
      (res) => {
        res.resume(); // body consume karo (socket reuse ke liye)
        res.on("end", () => {
          const ms = Number(process.hrtime.bigint() - t0) / 1e6;
          latencies.push(ms);
          statusCounts[res.statusCode] = (statusCounts[res.statusCode] || 0) + 1;
          if (res.statusCode >= 400) errors++;
          done++;
          resolve();
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", () => {
      errors++;
      done++;
      resolve();
    });
  });
}

async function worker(stopAt) {
  while (Date.now() < stopAt) await hit();
}

function pct(sorted, p) {
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

// dbheavy mode: pehle category ids laao (random category filter ke liye).
function fetchCategories() {
  return new Promise((resolve) => {
    lib.get({ host: base.hostname, port: base.port, path: "/api/category", agent }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        try {
          const data = JSON.parse(body).data ?? [];
          dbCategories = data.flatMap((c) => [c.id, ...c.children.map((s) => s.id)]);
        } catch {}
        resolve();
      });
    }).on("error", () => resolve());
  });
}

(async () => {
  console.log(`Load test -> ${HOST}${DB_HEAVY ? "  [DB-HEAVY: har request cache-miss]" : ""}`);
  console.log(`Concurrency: ${CONCURRENCY} virtual users | Duration: ${DURATION_S}s\n`);
  if (DB_HEAVY) await fetchCategories();

  const stopAt = Date.now() + DURATION_S * 1000;
  const t0 = Date.now();

  // Live progress har 5s.
  const progress = setInterval(() => {
    const s = (Date.now() - t0) / 1000;
    process.stdout.write(`  ${s.toFixed(0)}s: ${done} reqs (${(done / s).toFixed(0)} rps), errors: ${errors}\r\n`);
  }, 5000);

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(stopAt)));
  clearInterval(progress);

  const elapsed = (Date.now() - t0) / 1000;
  latencies.sort((a, b) => a - b);
  const rps = done / elapsed;

  console.log("\n===== RESULT =====");
  console.log(`Total requests : ${done}`);
  console.log(`Errors         : ${errors} (${((errors / Math.max(done, 1)) * 100).toFixed(2)}%)`);
  console.log(`Status codes   : ${JSON.stringify(statusCounts)}`);
  console.log(`Throughput     : ${rps.toFixed(1)} req/sec`);
  if (latencies.length) {
    console.log(`Latency p50    : ${pct(latencies, 50).toFixed(0)} ms`);
    console.log(`Latency p95    : ${pct(latencies, 95).toFixed(0)} ms`);
    console.log(`Latency p99    : ${pct(latencies, 99).toFixed(0)} ms`);
  }
  // 1 active user ≈ 1 req / 7 sec (browse pace) maan ke capacity estimate.
  const liveUsers = Math.round(rps * 7);
  console.log(`\nEstimated capacity: ~${liveUsers.toLocaleString()} LIVE concurrent users`);
  console.log(`(daily users isse 10-20x hote hain — sab ek saath online nahi hote)`);
})();
