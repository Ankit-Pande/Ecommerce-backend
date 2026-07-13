import { prisma } from "../config/db";
import { embedBatch, geminiEnabled } from "../integration/gemini";
import { logger } from "../config/winston";

// Backfill — purane products ke embeddings (naye admin save pe apne aap bante hain).
// FREE TIER REALITY: Gemini embeddings 100 requests/MINUTE (batch ka har item = 1 request)
// + daily cap. Isliye: 90 ka batch -> 62s wait -> agla. PRIORITY order me chalta hai
// (trending + purane curated pehle) — jo embed ho gaye wahi semantic me milte hain,
// baaki full-text se milte hi hain. Daily quota khatam -> gracefully exit; KAL phir
// chalao (idempotent — sirf bache hue uthte hain): npm run embed:backfill

const BATCH = 90; // free tier: 100/min se neeche raho
const MINUTE_GAP_MS = 62_000;
const MAX_CONSECUTIVE_429 = 5; // itni baar lagataar quota-fail = daily cap khatam

type Row = {
  id: string; name: string; description: string; color: string | null;
  brand: string | null; category: string | null;
};

async function main() {
  if (!geminiEnabled()) {
    logger.error("GEMINI_API_KEY missing — backfill nahi chal sakta");
    process.exit(1);
  }

  const [{ count }] = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count FROM "Product" WHERE "embedding" IS NULL`;
  const total = Number(count);
  logger.info(`Backfill: ${total.toLocaleString()} products bache hain`);

  let done = 0;
  let consecutive429 = 0;
  for (;;) {
    // Agla batch — PRIORITY: trending pehle, phir purane (curated originals) —
    // name+brand+category+color+description sab ek text me (context-rich).
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT p.id, p.name, p.description, p.color, b.name AS brand, c.name AS category
      FROM "Product" p
      LEFT JOIN "Brand" b ON b.id = p."brandId"
      LEFT JOIN "Category" c ON c.id = p."categoryId"
      WHERE p."embedding" IS NULL
      ORDER BY p."isTrending" DESC, p."createdAt" ASC
      LIMIT ${BATCH}`;
    if (rows.length === 0) break;

    const texts = rows.map((r) =>
      [r.name, r.brand, r.category, r.color, r.description].filter(Boolean).join(". ")
    );
    const vectors = await embedBatch(texts);

    // Ek hi UPDATE me poora batch (VALUES join) — 90 alag round-trips nahi.
    // id uuid hai aur vector sirf numbers — inline safe.
    const pairs = rows
      .map((r, i) => (vectors[i] ? `('${r.id}', '[${vectors[i]!.join(",")}]')` : null))
      .filter(Boolean);
    if (pairs.length > 0) {
      consecutive429 = 0;
      await prisma.$executeRawUnsafe(`
        UPDATE "Product" AS p SET "embedding" = v.emb::vector
        FROM (VALUES ${pairs.join(",")}) AS v(id, emb)
        WHERE p.id = v.id::text`);
      done += pairs.length;
      logger.info(`Backfill: ${done.toLocaleString()}/${total.toLocaleString()} done`);
    } else {
      // Poora batch fail = quota. Kuch baar lagataar ho to daily cap khatam — exit.
      consecutive429++;
      if (consecutive429 >= MAX_CONSECUTIVE_429) {
        logger.info(
          `Aaj ka embedding quota khatam (${done.toLocaleString()} bane). ` +
          `KAL dobara chalao: npm run embed:backfill — wahi se aage banega.`
        );
        break;
      }
    }

    // Free tier: 100 embeddings/min — har batch ke baad ek minute ka gap.
    await new Promise((r) => setTimeout(r, MINUTE_GAP_MS));
  }

  logger.info(`Backfill session done: ${done.toLocaleString()} embeddings is run me bane`);
  await prisma.$disconnect();
}

main();
