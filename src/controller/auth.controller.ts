import { Request, Response } from "express";
import { authService } from "../service/auth.service";
import { tokenService } from "../service/token.service";
import { AppError } from "../utils/appError";
import { asyncHandler } from "../utils/asyncHandler";
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from "../utils/cookies";

// POST /auth/send-otp — sends a login OTP to the phone.
export const sendOtp = asyncHandler(async (req: Request, res: Response) => {
  await authService.requestOtp(req.body.phone);
  res.json({ success: true, message: "OTP sent successfully" });
});

// POST /auth/verify-otp — logs in (new users are created); access token in the body, refresh token in a cookie.
export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const { user, accessToken, refreshToken } = await authService.verifyOtpAndLogin(req.body.phone, req.body.otp);
  setRefreshCookie(res, refreshToken);
  res.json({ success: true, data: { user, accessToken } });
});

// POST /auth/refresh — swaps the refresh cookie for a new access token and a new refresh cookie.
export const refreshTokens = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = readRefreshCookie(req);
  if (!refreshToken) throw new AppError("Refresh token required", 401);

  const tokens = await tokenService.refreshSession(refreshToken);
  setRefreshCookie(res, tokens.refreshToken);
  res.json({ success: true, data: { accessToken: tokens.accessToken } });
});

// POST /auth/logout — ends this device's session and clears the cookie.
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = readRefreshCookie(req);
  if (refreshToken) await tokenService.logout(refreshToken);
  clearRefreshCookie(res);
  res.json({ success: true, message: "Logged out successfully" });
});
