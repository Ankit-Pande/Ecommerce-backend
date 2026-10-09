import { Request, Response } from "express";
import { userService } from "../service/user.service";
import { asyncHandler } from "../utils/asyncHandler";
import { clearRefreshCookie } from "../utils/cookies";

// Apni profile.
export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.getMe(req.user!.userId);
  res.json({ success: true, data: user });
});

// Profile badlo.
export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.updateMe(req.user!.userId, req.body);
  res.json({ success: true, data: user });
});

// Apna account delete karo aur cookie hatao.
export const deleteMe = asyncHandler(async (req: Request, res: Response) => {
  await userService.deleteAccount(req.user!.userId);
  clearRefreshCookie(res);
  res.json({ success: true, message: "Account deleted" });
});
