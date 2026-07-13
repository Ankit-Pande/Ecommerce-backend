import { Router } from "express";
import { authRoutes } from "./auth.routes";
import { homeRoutes } from "./home.routes";
import { userRoutes } from "./user.routes";
import { categoryRoutes } from "./category.routes";
import { brandRoutes } from "./brand.routes";
import { productRoutes } from "./product.routes";
import { cartRoutes } from "./cart.routes";
import { addressRoutes } from "./address.routes";
import { orderRoutes } from "./order.routes";
import { adminRoutes } from "./admin.routes";
import { assistantRoutes } from "./assistant.routes";

// Saare module routes ek jagah. /health aur /order/webhook app.ts me alag mount hote hain.
const router = Router();

router.use("/home", homeRoutes);
router.use("/auth", authRoutes);
router.use("/user", userRoutes);
router.use("/category", categoryRoutes);
router.use("/brand", brandRoutes);
router.use("/product", productRoutes);
router.use("/cart", cartRoutes);
router.use("/address", addressRoutes);
router.use("/order", orderRoutes);
router.use("/admin", adminRoutes);
router.use("/assistant", assistantRoutes);

export const apiRoutes = router;
