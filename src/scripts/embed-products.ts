import { prisma } from "../config/db";
import { redis } from "../config/redis";
import { geminiReady } from "../integration/gemini";
import { embeddingService } from "../service/embedding.service";
import { AppError } from "../utils/appError";

const BATCH = 50;
const WAIT_MS = 60000;

// Jin products ka AI embedding nahi bana unka bana do; Gemini limit (429) par 1 minute ruk kar aage.
async function main() {
  if (!geminiReady) throw new Error("GEMINI_API_KEY is missing");
  let done = 0;
  for (;;) {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Product" WHERE "embedding" IS NULL AND "isActive" = true LIMIT ${BATCH}`;
    if (rows.length === 0) break;
    try {
      await embeddingService.syncProducts(rows.map((row) => row.id));
      done += rows.length;
      console.log(`Embedded ${done} products`);
    } catch (error) {
      if (!(error instanceof AppError && error.message.includes("429"))) throw error;
      console.log("Gemini limit (429), 1 minute ruk kar dobara...");
      await new Promise((resolve) => setTimeout(resolve, WAIT_MS));
    }
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
