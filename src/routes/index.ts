import { Router } from "express";
import { addressRoutes } from "./address.routes";
import { adminRoutes } from "./admin.routes";
import { assistantRoutes } from "./assistant.routes";
import { authRoutes } from "./auth.routes";
import { cartRoutes } from "./cart.routes";
import { catalogRoutes } from "./catalog.routes";
import { homeRoutes } from "./home.routes";
import { orderRoutes } from "./order.routes";
import { productRoutes } from "./product.routes";
import { userRoutes } from "./user.routes";

const router = Router();

router.use("/home", homeRoutes);
router.use("/catalog", catalogRoutes);
router.use("/products", productRoutes);
router.use("/auth", authRoutes);
router.use("/user", userRoutes);
router.use("/address", addressRoutes);
router.use("/cart", cartRoutes);
router.use("/order", orderRoutes);
router.use("/admin", adminRoutes);
router.use("/assistant", assistantRoutes);

export const apiRoutes = router;
