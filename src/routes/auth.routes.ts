import { Router } from "express";
import { logout, refreshTokens, sendOtp, verifyOtp } from "../controller/auth.controller";
import { rateLimiter } from "../middleware/rateLimiter";
import { validate } from "../middleware/validate";
import { sendOtpSchema, verifyOtpSchema } from "../validation/auth.validation";

const router = Router();

router.post(
  "/send-otp",
  rateLimiter({ name: "send-otp", seconds: 3600, maxRequests: 20 }),
  validate(sendOtpSchema),
  sendOtp,
);

router.post(
  "/verify-otp",
  rateLimiter({ name: "verify-otp", seconds: 60, maxRequests: 10 }),
  validate(verifyOtpSchema),
  verifyOtp,
);

router.post("/refresh", rateLimiter({ name: "refresh", seconds: 60, maxRequests: 120 }), refreshTokens);
router.post("/logout", logout);

export const authRoutes = router;
