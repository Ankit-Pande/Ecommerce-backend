import { Request, Response } from "express";
import { authService } from "../service/auth.service";
import { tokenService } from "../service/token.service";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/appError";
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from "../utils/cookies";

// Phone par OTP bhejo.
export const sendOtp = asyncHandler(async (req: Request, res: Response) => {
  await authService.requestOtp(req.body.phone);
  res.json({ success: true, message: "OTP sent successfully" });
});

// OTP sahi ho to login: access token jawab me, refresh token cookie me.
export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const { user, accessToken, refreshToken } = await authService.verifyOtpAndLogin(req.body.phone, req.body.otp);
  setRefreshCookie(res, refreshToken);
  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        alternatePhone: user.alternatePhone,
        role: user.role,
      },
      accessToken,
    },
  });
});

// Cookie wale refresh token se naya access token do.
export const refreshTokens = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = readRefreshCookie(req);
  if (!refreshToken) throw new AppError("Refresh token required", 401);

  const tokens = await tokenService.refreshSession(refreshToken);
  setRefreshCookie(res, tokens.refreshToken);
  res.json({ success: true, data: { accessToken: tokens.accessToken } });
});

// Logout: session band aur cookie hatao.
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = readRefreshCookie(req);
  if (refreshToken) await tokenService.logout(refreshToken);
  clearRefreshCookie(res);
  res.json({ success: true, message: "Logged out successfully" });
});
