import { Request, Response } from "express";
import { authService } from "../service/auth.service";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/appError";
import {
  setRefreshCookie,
  clearRefreshCookie,
  readRefreshCookie,
} from "../utils/cookies";

// SECURITY: access token response body me (client memory me rakhta hai), refresh token
// httpOnly Secure cookie me (JS/XSS access nahi kar sakta). Android jaise non-browser
// clients ke liye refresh token body me bhi milta hai (cookie ignore kar dein).
// authCheck "Authorization: Bearer" header se access token padhta hai.

export const sendOtp = asyncHandler(async (req: Request, res: Response) => {
  const { phone } = req.body;
  await authService.requestOtp(phone);
  res.json({ success: true, message: "OTP sent successfully" });
});

export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const { phone, otp } = req.body;
  const { user, accessToken, refreshToken } =
    await authService.verifyOtpAndLogin(phone, otp);

  // Refresh token -> httpOnly cookie (web). Body me bhi (Android/non-browser).
  setRefreshCookie(res, refreshToken);

  res.json({
    success: true,
    data: {
      user: { id: user.id, phone: user.phone, name: user.name, role: user.role },
      accessToken,
      refreshToken,
    },
  });
});

export const refreshTokens = asyncHandler(
  async (req: Request, res: Response) => {
    // Cookie (web) ya body (Android) — dono support.
    const refreshToken = readRefreshCookie(req) ?? req.body?.refreshToken;
    if (!refreshToken) throw new AppError("Refresh token required", 401);

    const tokens = await authService.refreshSession(refreshToken);
    // Rotation — naya refresh token wapas cookie me.
    setRefreshCookie(res, tokens.refreshToken);

    res.json({ success: true, data: tokens });
  }
);

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = readRefreshCookie(req) ?? req.body?.refreshToken;
  if (refreshToken) {
    await authService.logout(refreshToken);
  }
  clearRefreshCookie(res);
  res.json({ success: true, message: "Logged out successfully" });
});
