import { Router } from "express";
import { prisma } from "../config/db";
import { redis } from "../config/redis";
import { rateLimiter } from "../middleware/rateLimiter";

const router = Router();

// Liveness check: the process is up.
router.get("/", (_req, res) => {
  res.json({ status: "ok" });
});

// Readiness check: the database and Redis both answer.
router.get(
  "/ready",
  rateLimiter({ name: "health", seconds: 60, maxRequests: 60, allowIfRedisDown: true }),
  async (_req, res) => {
    try {
      await Promise.all([prisma.$queryRaw`SELECT 1`, redis.ping()]);
      res.json({ status: "ready" });
    } catch {
      res.status(503).json({ status: "unavailable" });
    }
  },
);

export const healthRoutes = router;
