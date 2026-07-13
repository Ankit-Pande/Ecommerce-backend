import { Router } from "express";
import { getMe, updateMe } from "../controller/user.controller";
import { authCheck } from "../middleware/authCheck";
import { validate } from "../middleware/validate";
import { updateMeSchema } from "../validation/user.validation";

const router = Router();

// Apna profile — login zaroori.
router.use(authCheck);

router.get("/me", getMe);
router.patch("/me", validate(updateMeSchema), updateMe);

export const userRoutes = router;
