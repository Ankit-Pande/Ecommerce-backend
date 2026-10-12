import { Router } from "express";
import { addToCart, getCart, removeCartItem, updateCartItem } from "../controller/cart.controller";
import { authCheck } from "../middleware/authCheck";
import { validate } from "../middleware/validate";
import { addToCartSchema, updateCartItemSchema } from "../validation/cart.validation";
import { idParamSchema } from "../validation/common";

const router = Router();

router.use(authCheck);

router.get("/", getCart);
router.post("/", validate(addToCartSchema), addToCart);
router.patch("/:id", validate(updateCartItemSchema), updateCartItem);
router.delete("/:id", validate(idParamSchema), removeCartItem);

export const cartRoutes = router;
