import { app } from "./app";
import { env } from "./config/env";
import { prisma } from "./config/db";
import { redis } from "./config/redis";
import { logger } from "./config/winston";
import { embeddingService } from "./service/embedding.service";
import { orderService } from "./service/order.service";
import { productService } from "./service/product.service";
import { tokenService } from "./service/token.service";

const ONE_MINUTE = 60 * 1000;
const ONE_DAY = 24 * 60 * ONE_MINUTE;

function runEvery(ms: number, name: string, job: () => Promise<unknown>) {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    await job().catch((error) => logger.error(`${name} failed`, { error }));
    running = false;
  };
  run();
  return setInterval(run, ms);
}

async function start() {
  await prisma.$connect();
  logger.info("Database connected");

  const server = app.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT} [${env.NODE_ENV}]`);
  });

  const jobs = [
    runEvery(ONE_MINUTE, "Order expiry job", () => orderService.releaseExpiredOrders()),
    runEvery(ONE_MINUTE, "Offer expiry job", () => productService.expireOffers()),
    runEvery(ONE_MINUTE, "Embedding job", () => embeddingService.fillMissing()),
    runEvery(ONE_DAY, "Session cleanup job", () => tokenService.deleteExpiredSessions()),
  ];

  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    jobs.forEach(clearInterval);
    server.close(async () => {
      await prisma.$disconnect();
      redis.disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((error) => {
  logger.error("Server startup failed", { error });
  process.exit(1);
});
