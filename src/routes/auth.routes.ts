import { Router } from "express";
import {
  sendOtp,
  verifyOtp,
  refreshTokens,
  logout,
} from "../controller/auth.controller";
import { validate } from "../middleware/validate";
import { otpIpLimiter, rateLimiter } from "../middleware/rateLimiter";
import {
  sendOtpSchema,
  verifyOtpSchema,
  refreshSchema,
  logoutSchema,
} from "../validation/auth.validation";

const router = Router();

// OTP send: IP limiter (30/hr -> 30min block) + phone limiter otp.service me.
router.post("/send-otp", otpIpLimiter, validate(sendOtpSchema), sendOtp);

// Verify: brute-force rok ke liye IP rate limit (10/min).
router.post(
  "/verify-otp",
  rateLimiter({ bucket: "verify-otp", windowSec: 60, max: 10 }),
  validate(verifyOtpSchema),
  verifyOtp
);

router.post("/refresh", validate(refreshSchema), refreshTokens);
router.post("/logout", validate(logoutSchema), logout);

export const authRoutes = router;
