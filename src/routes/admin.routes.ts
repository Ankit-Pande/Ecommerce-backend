import { Router } from "express";
import {
  blockUser,
  bulkCreateProducts,
  createBanner,
  createBrand,
  createCategory,
  createProduct,
  deleteBanner,
  deleteBrand,
  deleteCategory,
  deleteProduct,
  deleteReview,
  getAdminProduct,
  listAdminBanners,
  listAdminBrands,
  listAdminCategories,
  listAdminOrders,
  getAdminStats,
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
  applySale,
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
  saleSchema,
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

// Uploads: 10 image tak (zyada RAM leta hai, isliye apni limit).
router.post(
  "/uploads",
  rateLimiter({ bucket: "admin-upload", windowSec: 60, max: 30 }),
  upload.array("images", 10),
  uploadImages,
);

// Products (max 6 image; multer pehle, taaki validate ko form fields milein).
router.get("/products", validate(adminListProductSchema), listAdminProducts);
router.get("/products/:id", validate(idParamSchema), getAdminProduct);
router.post("/products", upload.array("images", 6), validate(createProductSchema), createProduct);
router.post("/products/bulk", validate(bulkCreateProductSchema), bulkCreateProducts);
router.post("/products/sale", validate(saleSchema), applySale);
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
router.patch("/brands/:id", validate(updateBrandSchema), updateBrand);
router.delete("/brands/:id", validate(idParamSchema), deleteBrand);

// Banners
router.get("/banners", listAdminBanners);
router.post("/banners", upload.single("image"), validate(createBannerSchema), createBanner);
router.patch("/banners/:id", validate(updateBannerSchema), updateBanner);
router.delete("/banners/:id", validate(idParamSchema), deleteBanner);

// Orders
router.get("/stats", getAdminStats);
router.get("/orders", validate(adminListOrderSchema), listAdminOrders);
router.patch("/orders/:id/status", validate(updateOrderStatusSchema), updateOrderStatus);
router.patch("/orders/:id/refunded", validate(idParamSchema), markOrderRefunded);

// Users (role badalna sirf SUPER_ADMIN)
router.get("/users", validate(adminListUserSchema), listAdminUsers);
router.patch("/users/:id/block", validate(blockUserSchema), blockUser);
router.patch("/users/:id/role", roleCheck("SUPER_ADMIN"), validate(setUserRoleSchema), setUserRole);

// Reviews
router.delete("/reviews/:id", validate(idParamSchema), deleteReview);

export const adminRoutes = router;
