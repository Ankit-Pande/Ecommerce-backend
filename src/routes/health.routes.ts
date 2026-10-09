import { Router } from "express";
import { prisma } from "../config/db";
import { redis } from "../config/redis";
import { rateLimiter } from "../middleware/rateLimiter";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ status: "ok" });
});

// DB aur Redis dono chal rahe hain ya nahi (minute me 60 baar tak).
const readyLimiter = rateLimiter({ name: "health", seconds: 60, maxRequests: 60, allowIfRedisDown: true });

router.get("/ready", readyLimiter, async (_req, res) => {
  try {
    await Promise.all([prisma.$queryRaw`SELECT 1`, redis.ping()]);
    res.json({ status: "ready" });
  } catch {
    res.status(503).json({ status: "unavailable" });
  }
});

export const healthRoutes = router;
