import { Router } from "express";
import {
  blockUser,
  bulkCreateProducts,
  createBanner,
  createBrand,
  createCategory,
  createProduct,
  deleteAdminUser,
  deleteBanner,
  deleteBrand,
  deleteCategory,
  deleteProduct,
  deleteReview,
  getAdminOrder,
  getAdminProduct,
  getAdminUser,
  listAdminBanners,
  listAdminBrands,
  listAdminCategories,
  listAdminOrders,
  listAdminProducts,
  listAdminUsers,
  markOrderRefunded,
  setUserRole,
  updateBanner,
  updateBrand,
  updateCategory,
  updateOrderStatus,
  updateProduct,
  uploadImages,
} from "../controller/admin.controller";
import { authCheck } from "../middleware/authCheck";
import { rateLimiter } from "../middleware/rateLimiter";
import { roleCheck } from "../middleware/roleCheck";
import { validate } from "../middleware/validate";
import { upload } from "../integration/storage";
import {
  adminListOrderSchema,
  adminListProductSchema,
  adminListUserSchema,
  blockUserSchema,
  bulkCreateProductSchema,
  createBannerSchema,
  createBrandSchema,
  createCategorySchema,
  createProductSchema,
  idParamSchema,
  setUserRoleSchema,
  updateBannerSchema,
  updateBrandSchema,
  updateCategorySchema,
  updateOrderStatusSchema,
  updateProductSchema,
} from "../validation/admin.validation";

const router = Router();

// Poora admin area: login + ADMIN/SUPER_ADMIN.
router.use(authCheck, roleCheck("ADMIN", "SUPER_ADMIN"));

// Uploads (bulk product se pehle URLs). Ek request me 10 x 2MB tak memory me aata hai —
// poori app me sirf yahi route itni RAM leta hai, isliye apni limit.
router.post(
  "/uploads",
  rateLimiter({ bucket: "admin-upload", windowSec: 60, max: 30 }),
  upload.array("images", 10),
  uploadImages,
);

// Products (max 6 image). Multer pehle chalta hai taaki validate ko form fields milein.
router.get("/products", validate(adminListProductSchema), listAdminProducts);
router.get("/products/:id", validate(idParamSchema), getAdminProduct);
router.post("/products", upload.array("images", 6), validate(createProductSchema), createProduct);
router.post("/products/bulk", validate(bulkCreateProductSchema), bulkCreateProducts);
router.patch("/products/:id", upload.array("images", 6), validate(updateProductSchema), updateProduct);
router.delete("/products/:id", validate(idParamSchema), deleteProduct);

// Categories
router.get("/categories", listAdminCategories);
router.post("/categories", upload.single("image"), validate(createCategorySchema), createCategory);
router.patch("/categories/:id", upload.single("image"), validate(updateCategorySchema), updateCategory);
router.delete("/categories/:id", validate(idParamSchema), deleteCategory);

// Brands
router.get("/brands", listAdminBrands);
router.post("/brands", upload.single("logo"), validate(createBrandSchema), createBrand);
router.patch("/brands/:id", upload.single("logo"), validate(updateBrandSchema), updateBrand);
router.delete("/brands/:id", validate(idParamSchema), deleteBrand);

// Banners
router.get("/banners", listAdminBanners);
router.post("/banners", upload.single("image"), validate(createBannerSchema), createBanner);
router.patch("/banners/:id", upload.single("image"), validate(updateBannerSchema), updateBanner);
router.delete("/banners/:id", validate(idParamSchema), deleteBanner);

// Orders
router.get("/orders", validate(adminListOrderSchema), listAdminOrders);
router.get("/orders/:id", validate(idParamSchema), getAdminOrder);
router.patch("/orders/:id/status", validate(updateOrderStatusSchema), updateOrderStatus);
router.patch("/orders/:id/refunded", validate(idParamSchema), markOrderRefunded);

// Users (role badalna sirf SUPER_ADMIN)
router.get("/users", validate(adminListUserSchema), listAdminUsers);
router.get("/users/:id", validate(idParamSchema), getAdminUser);
router.patch("/users/:id/block", validate(blockUserSchema), blockUser);
router.patch("/users/:id/role", roleCheck("SUPER_ADMIN"), validate(setUserRoleSchema), setUserRole);
router.delete("/users/:id", validate(idParamSchema), deleteAdminUser);

// Reviews
router.delete("/reviews/:id", validate(idParamSchema), deleteReview);

export const adminRoutes = router;
