import { Router } from "express";
import { addressRoutes } from "./address.routes";
import { adminRoutes } from "./admin.routes";
import { authRoutes } from "./auth.routes";
import { cartRoutes } from "./cart.routes";
import { catalogRoutes } from "./catalog.routes";
import { homeRoutes } from "./home.routes";
import { orderRoutes } from "./order.routes";
import { productRoutes } from "./product.routes";
import { userRoutes } from "./user.routes";

// Saare /api routes (/health aur webhook app.ts me hain).
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

export const apiRoutes = router;
