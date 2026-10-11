import { Router } from "express";
import { addToCart, getCart, removeCartItem, updateCartItem } from "../controller/cart.controller";
import { authCheck } from "../middleware/authCheck";
import { validate } from "../middleware/validate";
import { addToCartSchema, cartItemParamSchema, updateCartItemSchema } from "../validation/cart.validation";

const router = Router();

router.use(authCheck);

router.get("/", getCart);
router.post("/", validate(addToCartSchema), addToCart);
router.patch("/:itemId", validate(updateCartItemSchema), updateCartItem);
router.delete("/:itemId", validate(cartItemParamSchema), removeCartItem);

export const cartRoutes = router;
