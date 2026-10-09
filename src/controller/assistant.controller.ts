import { Request, Response } from "express";
import { assistantService } from "../service/assistant.service";
import { asyncHandler } from "../utils/asyncHandler";

// AI chat ka ek sawal-jawab (guest bhi, login user bhi).
export const chat = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user ? { userId: req.user.userId, isAdmin: req.user.role !== "USER" } : null;
  const data = await assistantService.chat(user, req.user?.userId ?? req.ip ?? "unknown", req.body);
  res.json({ success: true, data });
});
