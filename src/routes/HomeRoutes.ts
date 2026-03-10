import { Router } from "express"
import { validate } from "../middlewares/Validation"
import {
  homePaginationSchema,
  slugParamSchema,
  trackViewSchema,
} from "../validation/Home"

import {
  getHomePage,
  getCategoryProducts,
  getSimilar,
  trackView,
  getRecentlyViewed,
} from "../controllers/HomeControll"

import { authCheck } from "../middlewares/Authcheck"

const router = Router()

// Public Routes
router.get("/", getHomePage)

router.get(
  "/category/:slug",
  validate(slugParamSchema),
  validate(homePaginationSchema),
  getCategoryProducts
)

router.get("/similar", getSimilar)

// Protected Routes
router.post(
  "/track-view",
  authCheck,
  validate(trackViewSchema),
  trackView
)

router.get(
  "/recently-viewed",
  authCheck,
  getRecentlyViewed
)

export const homeRoutes = router