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
import { idParamSchema } from "../validation/common";
import { checkoutSchema, listOrderSchema, verifyPaymentSchema } from "../validation/order.validation";

const router = Router();

router.use(authCheck);

router.post(
  "/checkout",
  rateLimiter({ name: "checkout", seconds: 60, maxRequests: 10, allowIfRedisDown: true }),
  validate(checkoutSchema),
  checkout,
);
router.get("/", validate(listOrderSchema), listOrders);
router.get("/:id", validate(idParamSchema), getOrder);
router.post("/:id/payment", validate(idParamSchema), retryPayment);
router.post(
  "/:id/verify-payment",
  rateLimiter({ name: "verify-payment", seconds: 60, maxRequests: 10, allowIfRedisDown: true }),
  validate(verifyPaymentSchema),
  verifyPayment,
);
router.patch("/:id/cancel", validate(idParamSchema), cancelOrder);

export const orderRoutes = router;
