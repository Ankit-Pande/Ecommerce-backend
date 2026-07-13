import { Router } from "express";
import {
  checkout,
  listOrders,
  getOrder,
  cancelOrder,
} from "../controller/order.controller";
import { authCheck } from "../middleware/authCheck";
import { validate } from "../middleware/validate";
import {
  checkoutSchema,
  orderIdSchema,
  listOrderSchema,
} from "../validation/order.validation";

const router = Router();

// Webhook app.ts me alag mount hai (raw body). Yahan sab login-protected.
router.use(authCheck);

router.post("/checkout", validate(checkoutSchema), checkout);
router.get("/", validate(listOrderSchema), listOrders);
router.get("/:id", validate(orderIdSchema), getOrder);
router.patch("/:id/cancel", validate(orderIdSchema), cancelOrder);

export const orderRoutes = router;
