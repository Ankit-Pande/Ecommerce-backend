import { Router } from "express";
import { prisma } from "../config/db";
import { redis } from "../config/redis";
import { rateLimiter } from "../middleware/rateLimiter";

const router = Router();

// Uptime ping — DB nahi chhoota.
router.get("/", (_req, res) => {
  res.json({ status: "ok" });
});

// Deploy check: DB aur Redis dono chal rahe hain?
// Har call DB aur Redis dono chhuti hai — bina limit ke isi se pool khatam kiya ja sakta hai.
const readyLimiter = rateLimiter({ bucket: "health", windowSec: 60, max: 60, allowOnRedisDown: true });

router.get("/ready", readyLimiter, async (_req, res) => {
  try {
    await Promise.all([prisma.$queryRaw`SELECT 1`, redis.ping()]);
    res.json({ status: "ready" });
  } catch {
    res.status(503).json({ status: "unavailable" });
  }
});

export const healthRoutes = router;
