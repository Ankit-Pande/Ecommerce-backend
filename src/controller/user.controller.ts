import { Request, Response } from "express";
import { userService } from "../service/user.service";
import { asyncHandler } from "../utils/asyncHandler";
import { clearRefreshCookie } from "../utils/cookies";

// GET /user/me — the logged-in user's profile.
export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.getMe(req.user!.userId);
  res.json({ success: true, data: user });
});

// PATCH /user/me — changes name or email.
export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.updateMe(req.user!.userId, req.body);
  res.json({ success: true, data: user });
});

// DELETE /user/me — deletes the account and logs out every device.
export const deleteMe = asyncHandler(async (req: Request, res: Response) => {
  await userService.deleteAccount(req.user!.userId);
  clearRefreshCookie(res);
  res.json({ success: true, message: "Account deleted" });
});
