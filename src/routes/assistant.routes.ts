import { Router } from "express";
import { chat } from "../controller/assistant.controller";
import { optionalAuth } from "../middleware/authCheck";
import { rateLimiter } from "../middleware/rateLimiter";
import { validate } from "../middleware/validate";
import { chatSchema } from "../validation/assistant.validation";

const router = Router();

// Guest bhi chala sake; ek minute me 15 se zyada sawal nahi.
router.post(
  "/chat",
  optionalAuth,
  rateLimiter({ name: "assistant", seconds: 60, maxRequests: 15 }),
  validate(chatSchema),
  chat,
);

export const assistantRoutes = router;
