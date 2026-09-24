import { Router } from "express";
import { deleteMe, getMe, updateMe } from "../controller/user.controller";
import { authCheck } from "../middleware/authCheck";
import { validate } from "../middleware/validate";
import { updateMeSchema } from "../validation/user.validation";

const router = Router();

router.use(authCheck);

router.get("/me", getMe);
router.patch("/me", validate(updateMeSchema), updateMe);
router.delete("/me", deleteMe);

export const userRoutes = router;
