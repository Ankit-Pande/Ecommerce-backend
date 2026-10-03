import { Router } from "express";
import { addToCart, getCart, removeCartItem, updateCartItem } from "../controller/cart.controller";
import { authCheck } from "../middleware/authCheck";
import { validate } from "../middleware/validate";
import { addToCartSchema, cartItemParamSchema, updateCartItemSchema } from "../validation/cart.validation";

const router = Router();

router.use(authCheck);

router.get("/", getCart);
router.post("/", validate(addToCartSchema), addToCart);
router.patch("/:productId", validate(updateCartItemSchema), updateCartItem);
router.delete("/:productId", validate(cartItemParamSchema), removeCartItem);

export const cartRoutes = router;
