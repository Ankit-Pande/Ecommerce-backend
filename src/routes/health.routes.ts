import { Router } from "express";

// Hosting/uptime check. Koi auth nahi — bas server zinda hai ya nahi.
const router = Router();

router.get("/", (_req, res) => {
  res.json({ success: true, status: "ok", time: new Date().toISOString() });
});

export const healthRoutes = router;
