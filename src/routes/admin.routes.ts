import { Router } from "express";
import {
  uploadImages,
  bulkCreateProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  listAdminProducts,
  getAdminProduct,
  createCategory,
  updateCategory,
  deleteCategory,
  createBrand,
  updateBrand,
  deleteBrand,
  createBanner,
  updateBanner,
  deleteBanner,
  listAdminOrders,
  updateOrderStatus,
  listAdminUsers,
  blockUser,
  setUserRole,
} from "../controller/admin.controller";
import { authCheck } from "../middleware/authCheck";
import { roleCheck } from "../middleware/roleCheck";
import { validate } from "../middleware/validate";
import { upload } from "../integration/storage";
import {
  createProductSchema,
  bulkCreateProductSchema,
  updateProductSchema,
  adminListProductSchema,
  idParamSchema,
  createCategorySchema,
  updateCategorySchema,
  createBrandSchema,
  updateBrandSchema,
  createBannerSchema,
  updateBannerSchema,
  updateOrderStatusSchema,
  adminListOrderSchema,
  adminListUserSchema,
  blockUserSchema,
  setUserRoleSchema,
} from "../validation/admin.validation";

const router = Router();

// Saara admin area protected — login + admin role.
router.use(authCheck, roleCheck("ADMIN", "SUPER_ADMIN"));

// ---------- Uploads (images -> Cloudinary URLs, bulk se pehle) ----------
router.post("/uploads", upload.array("images", 10), uploadImages);

// ---------- Products (max 6 images) ----------
router.post("/products/bulk", validate(bulkCreateProductSchema), bulkCreateProducts);
router.get("/products", validate(adminListProductSchema), listAdminProducts);
router.get("/products/:id", validate(idParamSchema), getAdminProduct);
router.post(
  "/products",
  upload.array("images", 6),
  validate(createProductSchema),
  createProduct
);
router.patch(
  "/products/:id",
  upload.array("images", 6),
  validate(updateProductSchema),
  updateProduct
);
router.delete("/products/:id", validate(idParamSchema), deleteProduct);

// ---------- Categories (single image) ----------
router.post(
  "/categories",
  upload.single("image"),
  validate(createCategorySchema),
  createCategory
);
router.patch(
  "/categories/:id",
  upload.single("image"),
  validate(updateCategorySchema),
  updateCategory
);
router.delete("/categories/:id", validate(idParamSchema), deleteCategory);

// ---------- Brands (single logo) ----------
router.post(
  "/brands",
  upload.single("logo"),
  validate(createBrandSchema),
  createBrand
);
router.patch(
  "/brands/:id",
  upload.single("logo"),
  validate(updateBrandSchema),
  updateBrand
);
router.delete("/brands/:id", validate(idParamSchema), deleteBrand);

// ---------- Banners (single image) ----------
router.post(
  "/banners",
  upload.single("image"),
  validate(createBannerSchema),
  createBanner
);
router.patch(
  "/banners/:id",
  upload.single("image"),
  validate(updateBannerSchema),
  updateBanner
);
router.delete("/banners/:id", validate(idParamSchema), deleteBanner);

// ---------- Orders ----------
router.get("/orders", validate(adminListOrderSchema), listAdminOrders);
router.patch(
  "/orders/:id/status",
  validate(updateOrderStatusSchema),
  updateOrderStatus
);

// ---------- Users ----------
router.get("/users", validate(adminListUserSchema), listAdminUsers);
router.patch("/users/:id/block", validate(blockUserSchema), blockUser);
// Role change (make admin / remove admin) — sirf SUPER_ADMIN.
router.patch(
  "/users/:id/role",
  roleCheck("SUPER_ADMIN"),
  validate(setUserRoleSchema),
  setUserRole
);

export const adminRoutes = router;
