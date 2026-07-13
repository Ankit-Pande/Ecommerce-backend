import { Request, Response } from "express";
import { assistantService } from "../service/assistant.service";
import { asyncHandler } from "../utils/asyncHandler";

// Chat — guest bhi use kar sakta hai (optionalAuth). Quota role ke hisaab se:
// admin userId pe, user userId pe, guest IP pe.
export const chat = asyncHandler(async (req: Request, res: Response) => {
  const role = req.user?.role;
  const tier = role === "ADMIN" || role === "SUPER_ADMIN" ? "admin" : role === "USER" ? "user" : "guest";
  const quotaKey = req.user?.userId ?? req.ip ?? "unknown";

  const result = await assistantService.chat(
    req.body.message,
    req.body.history,
    req.body.offset,
    tier,
    quotaKey,
    req.user?.userId
  );
  res.json({ success: true, data: result });
});
