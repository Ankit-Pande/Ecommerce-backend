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

// Server chalu karo: DB se jodo, har minute aur roz wale kaam chalao, band hote waqt sab aaram se band karo.
const start = async () => {
  await connectDB();

  const server = app.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT} [${env.NODE_ENV}]`);
  });

  let isJobRunning = false;
  const everyMinuteJob = setInterval(async () => {
    if (isJobRunning) return;
    isJobRunning = true;
    try {
      await orderService.releaseExpiredOrders().catch((error) => logger.error("Order expiry job failed", { error }));
      await productService.expireOffers().catch((error) => logger.error("Offer expiry job failed", { error }));
    } finally {
      isJobRunning = false;
    }
  }, ONE_MINUTE);

  // Purani login sessions saaf karo (start par ek baar, phir roz).
  const cleanOldSessions = async () => {
    await tokenService.deleteExpiredSessions().catch((error) => logger.error("Session cleanup failed", { error }));
  };
  cleanOldSessions();
  const dailyJob = setInterval(cleanOldSessions, ONE_DAY);

  // Band karte waqt: naye request roko, phir DB aur Redis band (10 second me na ho to zabardasti band).
  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down...`);
    clearInterval(everyMinuteJob);
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
