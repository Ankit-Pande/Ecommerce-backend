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
import { checkoutSchema, listOrderSchema, orderIdSchema, verifyPaymentSchema } from "../validation/order.validation";

const router = Router();

router.use(authCheck);

router.post(
  "/checkout",
  rateLimiter({ name: "checkout", seconds: 60, maxRequests: 10 }),
  validate(checkoutSchema),
  checkout,
);
router.get("/", validate(listOrderSchema), listOrders);
router.get("/:id", validate(orderIdSchema), getOrder);
router.post("/:id/payment", validate(orderIdSchema), retryPayment);
router.post(
  "/:id/verify-payment",
  rateLimiter({ name: "verify-payment", seconds: 60, maxRequests: 10 }),
  validate(verifyPaymentSchema),
  verifyPayment,
);
router.patch("/:id/cancel", validate(orderIdSchema), cancelOrder);

export const orderRoutes = router;
