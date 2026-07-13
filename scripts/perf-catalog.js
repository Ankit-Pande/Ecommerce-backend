/*
 * Catalog scale test — 2 lakh synthetic products daal ke measure karo, phir hata do.
 *   node scripts/perf-catalog.js seed 200000   (2 lakh products insert, batches me)
 *   node scripts/perf-catalog.js clean         (saare perf- products delete)
 * Products real jaise hain (naam/brand/color/price random combos) taaki search/filter
 * ka result realistic ho. Slug "perf-" se shuru hota hai — cleanup isi se hota hai.
 */
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const ADJ = ["Classic", "Premium", "Ultra", "Smart", "Pro", "Eco", "Compact", "Deluxe", "Sporty", "Modern"];
const NOUN = ["Shirt", "Phone Case", "Bottle", "Sneakers", "Watch", "Bag", "Lamp", "Speaker", "Charger", "Jacket", "Mixer", "Toy Car", "Notebook", "Headset", "Tripod"];
const COLORS = ["black", "white", "blue", "red", "green", "grey", "brown", "silver"];

async function seed(total) {
  const cats = await prisma.category.findMany({
    where: { parentId: { not: null } },
    select: { id: true },
  });
  const brands = await prisma.brand.findMany({ select: { id: true } });
  if (cats.length === 0) throw new Error("Pehle normal seed chalao (categories chahiye)");

  const BATCH = 5000;
  let inserted = 0;
  const t0 = Date.now();
  while (inserted < total) {
    const n = Math.min(BATCH, total - inserted);
    const rows = Array.from({ length: n }, (_, i) => {
      const idx = inserted + i;
      const name = `${ADJ[idx % ADJ.length]} ${NOUN[idx % NOUN.length]} ${idx}`;
      return {
        name,
        slug: `perf-${idx}`,
        description: `${name} — scale test item, great quality.`,
        pricePaise: (100 + Math.floor(Math.random() * 99900)) * 100,
        discountPercent: Math.floor(Math.random() * 60),
        stock: 1 + Math.floor(Math.random() * 500),
        color: COLORS[idx % COLORS.length],
        categoryId: cats[idx % cats.length].id,
        brandId: brands.length ? brands[idx % brands.length].id : null,
        isTrending: false,
        images: [],
      };
    });
    await prisma.product.createMany({ data: rows, skipDuplicates: true });
    inserted += n;
    process.stdout.write(`  inserted ${inserted}/${total} (${((Date.now() - t0) / 1000).toFixed(0)}s)\r\n`);
  }
  const count = await prisma.product.count();
  console.log(`Done. Total products in DB now: ${count}`);
}

async function clean() {
  // 200k rows — chunks me delete (ek statement pe pooler timeout na ho).
  let total = 0;
  for (;;) {
    const batch = await prisma.product.findMany({
      where: { slug: { startsWith: "perf-" } },
      select: { id: true },
      take: 10000,
    });
    if (batch.length === 0) break;
    await prisma.product.deleteMany({ where: { id: { in: batch.map((b) => b.id) } } });
    total += batch.length;
    process.stdout.write(`  deleted ${total}\r\n`);
  }
  const count = await prisma.product.count();
  console.log(`Cleanup done (${total} removed). Total products in DB now: ${count}`);
}

(async () => {
  const cmd = process.argv[2];
  const total = parseInt(process.argv[3] || "200000", 10);
  try {
    if (cmd === "seed") await seed(total);
    else if (cmd === "clean") await clean();
    else console.log("Usage: node scripts/perf-catalog.js seed 200000 | clean");
  } catch (e) {
    console.error("ERROR:", e.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
