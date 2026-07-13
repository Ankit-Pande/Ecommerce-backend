import { app } from "./app";
import { env } from "./config/env";
import { connectDB, disconnectDB } from "./config/db";
import { disconnectRedis } from "./config/redis";
import { logger } from "./config/winston";
import { productService } from "./service/product.service";

const start = async () => {
  // DB connect pehle — fail ho to abhi pata chale.
  await connectDB();

  const server = app.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT} [${env.NODE_ENV}]`);
  });

  // Facets prewarm — filter panel (brands/colors) hamesha cache se instant mile.
  // Fire-and-forget (boot block nahi karta) + har 25 min refresh (TTL 30 min hai).
  const warm = () =>
    productService
      .warmFacets()
      .then(() => logger.info("Facets cache warmed"))
      .catch((err) => logger.warn("Facets warm failed", { err }));
  warm();
  setInterval(warm, 25 * 60 * 1000).unref();

  // Graceful shutdown — connections clean band karo.
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down...`);
    server.close(async () => {
      await disconnectDB();
      await disconnectRedis();
      logger.info("Shutdown complete");
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

start().catch((error) => {
  console.error("START ERROR:", error);
  process.exit(1);
});
