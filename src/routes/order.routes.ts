import { Router } from "express";
import {
  cancelOrder,
  checkout,
  getOrder,
  listOrders,
  retryPayment,
  verifyPayment,
} from "../controller/order.controller";
import { authCheck } from "../middleware/authCheck";
import { rateLimiter } from "../middleware/rateLimiter";
import { validate } from "../middleware/validate";
import {
  checkoutSchema,
  listOrderSchema,
  orderIdSchema,
  verifyPaymentSchema,
} from "../validation/order.validation";

const router = Router();

// Sab order routes login wale (webhook app.ts me alag hai).
router.use(authCheck);

router.post(
  "/checkout",
  rateLimiter({ bucket: "checkout", windowSec: 60, max: 10 }),
  validate(checkoutSchema),
  checkout,
);
router.post("/verify", validate(verifyPaymentSchema), verifyPayment);
router.get("/", validate(listOrderSchema), listOrders);
router.get("/:id", validate(orderIdSchema), getOrder);
router.post("/:id/payment", validate(orderIdSchema), retryPayment);
router.patch("/:id/cancel", validate(orderIdSchema), cancelOrder);

export const orderRoutes = router;
