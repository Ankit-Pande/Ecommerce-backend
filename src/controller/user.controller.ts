import { Request, Response } from "express";
import { userService } from "../service/user.service";
import { asyncHandler } from "../utils/asyncHandler";
import { clearRefreshCookie } from "../utils/cookies";

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.getMe(req.user!.userId);
  res.json({ success: true, data: user });
});

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.updateMe(req.user!.userId, req.body);
  res.json({ success: true, data: user });
});

export const deleteMe = asyncHandler(async (req: Request, res: Response) => {
  await userService.deleteAccount(req.user!.userId);
  clearRefreshCookie(res);
  res.json({ success: true, message: "Account deleted" });
});
