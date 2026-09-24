import { Router } from "express";
import { addToCart, clearCart, getCart, removeCartItem, updateCartItem } from "../controller/cart.controller";
import { authCheck } from "../middleware/authCheck";
import { validate } from "../middleware/validate";
import { addToCartSchema, cartItemParamSchema, updateCartItemSchema } from "../validation/cart.validation";

const router = Router();

router.use(authCheck);

router.get("/", getCart);
router.post("/", validate(addToCartSchema), addToCart);
router.patch("/:productId", validate(updateCartItemSchema), updateCartItem);
// "/clear" pehle — warna ":productId" use pakad leta.
router.delete("/clear", clearCart);
router.delete("/:productId", validate(cartItemParamSchema), removeCartItem);

export const cartRoutes = router;
