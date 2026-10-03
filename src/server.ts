import { app } from "./app";
import { env } from "./config/env";
import { connectDB, disconnectDB } from "./config/db";
import { disconnectRedis } from "./config/redis";
import { logger } from "./config/winston";
import { orderService } from "./service/order.service";
import { productService } from "./service/product.service";
import { tokenService } from "./service/token.service";

const ONE_MINUTE = 60 * 1000;
const ONE_DAY = 24 * 60 * ONE_MINUTE;

const start = async () => {
  await connectDB();

  const server = app.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT} [${env.NODE_ENV}]`);
  });

  // Har minute: unpaid order cancel + stock wapas, aur khatam offer hatao.
  let running = false;
  const minuteJob = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await orderService
        .releaseExpiredOrders()
        .catch((error) => logger.error("Order expiry job failed", { error }));
      await productService
        .expireOffers()
        .catch((error) => logger.error("Offer expiry job failed", { error }));
    } finally {
      running = false;
    }
  }, ONE_MINUTE);

  // Roz (aur start par ek baar): purani sessions saaf.
  const dailyCleanup = async () => {
    await tokenService
      .deleteExpiredSessions()
      .catch((error) => logger.error("Session cleanup failed", { error }));
  };
  dailyCleanup();
  const dailyJob = setInterval(dailyCleanup, ONE_DAY);

  // Band karte waqt: naye request roko, phir DB aur Redis band.
  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down...`);
    clearInterval(minuteJob);
    clearInterval(dailyJob);
    server.close(async () => {
      await disconnectDB();
      await disconnectRedis();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

start().catch((error) => {
  logger.error("Server startup failed", { error });
  process.exit(1);
});
