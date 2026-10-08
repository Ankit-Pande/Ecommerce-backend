import { prisma } from "../config/db";
import { redis } from "../config/redis";
import { geminiReady } from "../integration/gemini";
import { embeddingService } from "../service/embedding.service";

// Jin products ka AI embedding nahi bana unka bana do (seed/import ke baad ek baar chalao).
async function main() {
  if (!geminiReady) throw new Error("GEMINI_API_KEY is missing");
  let done = 0;
  for (;;) {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Product" WHERE "embedding" IS NULL AND "isActive" = true LIMIT 500`;
    if (rows.length === 0) break;
    const ids = rows.map((row) => row.id);
    await embeddingService.syncProducts(ids);
    done += ids.length;
    console.log(`Embedded ${done} products`);
  }
  console.log("All products embedded");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });
