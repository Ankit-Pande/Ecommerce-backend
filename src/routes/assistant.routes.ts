import { Router } from "express";
import { chat } from "../controller/assistant.controller";
import { optionalAuth } from "../middleware/optionalAuth";
import { rateLimiter } from "../middleware/rateLimiter";
import { validate } from "../middleware/validate";
import { chatSchema } from "../validation/assistant.validation";

const router = Router();

// IP rate limit (spam rok) + optionalAuth (guest allowed) + validation.
router.post(
  "/chat",
  rateLimiter({ bucket: "ai-chat", windowSec: 60, max: 20 }),
  optionalAuth,
  validate(chatSchema),
  chat
);

export const assistantRoutes = router;
