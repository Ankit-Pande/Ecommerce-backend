import { prisma } from "../config/db";
import { disconnectRedis } from "../config/redis";
import { geminiReady } from "../integration/gemini";
import { embeddingService } from "../service/embedding.service";

// Jin products ka AI embedding nahi bana unka bana do (seed/import ke baad ek baar chalao).
async function main() {
  if (!geminiReady) throw new Error("GEMINI_API_KEY is missing");
  let done = 0;
  for (;;) {
    const ids = await embeddingService.missingIds(500);
    if (ids.length === 0) break;
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
    await disconnectRedis();
  });
