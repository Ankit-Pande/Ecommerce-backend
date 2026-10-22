import { Request, Response } from "express";
import { visitorIp } from "../middleware/rateLimiter";
import { assistantService } from "../service/assistant.service";
import { asyncHandler } from "../utils/asyncHandler";

// POST /assistant/chat — answers one shopping question; guests are counted by IP.
export const chat = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user ? { userId: req.user.userId, isAdmin: req.user.role !== "USER" } : null;
  const data = await assistantService.chat(user, req.user?.userId ?? visitorIp(req.ip), req.body);
  res.json({ success: true, data });
});
