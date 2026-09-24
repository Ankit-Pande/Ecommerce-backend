import { Router } from "express";
import {
  getProduct,
  getProductsBySlugs,
  getRecentlyViewed,
  getRelatedProducts,
  listReviews,
  removeReview,
  saveReview,
} from "../controller/product.controller";
import { authCheck } from "../middleware/authCheck";
import { optionalAuth } from "../middleware/optionalAuth";
import { validate } from "../middleware/validate";
import {
  batchProductSchema,
  listReviewSchema,
  productSlugSchema,
  saveReviewSchema,
} from "../validation/product.validation";

const router = Router();

// "/batch" aur "/recently-viewed" pehle — warna ":slug" unhe slug samajh leta.
router.get("/batch", validate(batchProductSchema), getProductsBySlugs);
router.get("/recently-viewed", authCheck, getRecentlyViewed);

// Browse ke liye login nahi chahiye. Login ho to "recently viewed" me judta hai.
router.get("/:slug", optionalAuth, validate(productSlugSchema), getProduct);
router.get("/:slug/related", validate(productSlugSchema), getRelatedProducts);
router.get("/:slug/reviews", validate(listReviewSchema), listReviews);
router.post("/:slug/reviews", authCheck, validate(saveReviewSchema), saveReview);
router.delete("/:slug/reviews", authCheck, validate(productSlugSchema), removeReview);

export const productRoutes = router;
