import { app } from "./app";
import { env } from "./config/env";
import { prisma } from "./config/db";
import { redis } from "./config/redis";
import { logger } from "./config/winston";
import { embeddingService } from "./service/embedding.service";
import { orderService } from "./service/order.service";
import { productService } from "./service/product.service";
import { tokenService } from "./service/token.service";

const ONE_MINUTE_MS = 60 * 1000;
const ONE_DAY_MS = 24 * 60 * ONE_MINUTE_MS;
const FIRST_RUN_DELAY_MS = 10 * 1000;
const JOB_LOCK_MS = 10 * ONE_MINUTE_MS;

// Runs a job on a timer (first run 10 seconds after start) and returns a function that stops it.
function runEvery(intervalMs: number, name: string, job: () => Promise<unknown>) {
  let running = false;

  // Runs the job once, only if it is not running here already and this server copy gets the Redis lock.
  const runOnce = async () => {
    if (running) return;
    running = true;
    const lockKey = `job:${name}`;
    const gotLock = await redis.set(lockKey, "1", "PX", JOB_LOCK_MS, "NX").catch(() => "OK");
    if (gotLock) {
      await job().catch((error) => logger.error(`${name} failed`, { error }));
      await redis.del(lockKey).catch(() => null);
    }
    running = false;
  };

  const firstRun = setTimeout(runOnce, FIRST_RUN_DELAY_MS);
  const timer = setInterval(runOnce, intervalMs);
  return () => {
    clearTimeout(firstRun);
    clearInterval(timer);
  };
}

// Connects the database, starts the HTTP server and the background jobs, and shuts everything down on SIGTERM/SIGINT.
async function start() {
  await prisma.$connect();
  logger.info("Database connected");

  const server = app.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT} [${env.NODE_ENV}]`);
  });

  const stopJobs = [
    runEvery(ONE_MINUTE_MS, "Order expiry job", () => orderService.releaseExpiredOrders()),
    runEvery(ONE_MINUTE_MS, "Offer expiry job", () => productService.expireOffers()),
    runEvery(ONE_MINUTE_MS, "Embedding job", () => embeddingService.fillMissing()),
    runEvery(ONE_DAY_MS, "Session cleanup job", () => tokenService.deleteExpiredSessions()),
    runEvery(ONE_DAY_MS, "Webhook cleanup job", () => orderService.deleteOldWebhookEvents()),
  ];

  // Stops the jobs, lets open requests finish, closes the database and Redis, then exits (forced after 10 seconds).
  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    stopJobs.forEach((stop) => stop());
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
