import { Router } from "express";
import { logout, refreshTokens, sendOtp, verifyOtp } from "../controller/auth.controller";
import { rateLimiter } from "../middleware/rateLimiter";
import { validate } from "../middleware/validate";
import { sendOtpSchema, verifyOtpSchema } from "../validation/auth.validation";

const router = Router();

// Phone wali limit otp.service me hai; yahan sirf IP wali.
router.post(
  "/send-otp",
  rateLimiter({ bucket: "send-otp", windowSec: 3600, max: 20 }),
  validate(sendOtpSchema),
  sendOtp,
);

router.post(
  "/verify-otp",
  rateLimiter({ bucket: "verify-otp", windowSec: 60, max: 10 }),
  validate(verifyOtpSchema),
  verifyOtp,
);

// Refresh token cookie se aata hai, body nahi.
router.post("/refresh", rateLimiter({ bucket: "refresh", windowSec: 60, max: 30 }), refreshTokens);
router.post("/logout", logout);

export const authRoutes = router;
