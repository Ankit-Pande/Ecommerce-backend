import { prisma } from "../config/db";
import { redis } from "../config/redis";
import { geminiReady } from "../integration/gemini";
import { embeddingService } from "../service/embedding.service";
import { AppError } from "../utils/appError";

const WAIT_MS = 60000;

// Jin products ka AI embedding nahi bana unka bana do (100-100 karke); Gemini limit (429) par 1 minute ruk kar aage.
async function main() {
  if (!geminiReady) throw new Error("GEMINI_API_KEY is missing");
  let done = 0;
  for (;;) {
    try {
      const count = await embeddingService.fillMissing();
      if (count === 0) break;
      done += count;
      console.log(`Embedded ${done} products`);
    } catch (error) {
      if (!(error instanceof AppError && error.statusCode === 429)) throw error;
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
