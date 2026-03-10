import { Router } from "express"
import { Role } from "@prisma/client"

import { authCheck } from "../middlewares/Authcheck"
import { roleCheck } from "../middlewares/Rolecheck"
import { validate } from "../middlewares/Validation"

import {
  createCategorySchema,
  createProductSchema,
  updateStockSchema,
  getProductsSchema,
  idSchema,
  bannerSchema,
  productOfferSchema,
} from "../validation/Admin"

import {
  createCategory,
  createProduct,
  getProducts,
  updateStock,
  hideProduct,
  createBanner,
  deleteBanner,
  updateOffers,
} from "../controllers/AdminControll"

const router = Router()

// ✅ Public product list (admin panel ke liye)
router.get(
  "/products",
  validate(getProductsSchema),
  getProducts
)

// ✅ Sirf ADMIN access
router.use(authCheck, roleCheck(Role.ADMIN))

// Category
router.post(
  "/categories",
  validate(createCategorySchema),
  createCategory
)

// Product
router.post(
  "/products",
  validate(createProductSchema),
  createProduct
)

router.patch(
  "/products/:id/stock",
  validate(updateStockSchema),
  updateStock
)

router.patch(
  "/products/:id/hide",
  validate(idSchema),
  hideProduct
)

router.patch(
  "/products/:id/offers",
  validate(productOfferSchema),
  updateOffers
)

// Banner
router.post(
  "/banners",
  validate(bannerSchema),
  createBanner
)

router.delete(
  "/banners/:id",
  validate(idSchema),
  deleteBanner
)

export const adminRoutes = router