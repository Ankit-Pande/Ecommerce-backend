import { Router } from "express";
import {
  getProduct,
  getProductsBySlugs,
  getRelatedProducts,
  listReviews,
  saveReview,
} from "../controller/product.controller";
import { authCheck } from "../middleware/authCheck";
import { validate } from "../middleware/validate";
import {
  batchProductSchema,
  listReviewSchema,
  productSlugSchema,
  saveReviewSchema,
} from "../validation/product.validation";

const router = Router();

router.get("/batch", validate(batchProductSchema), getProductsBySlugs);

router.get("/:slug", validate(productSlugSchema), getProduct);
router.get("/:slug/related", validate(productSlugSchema), getRelatedProducts);
router.get("/:slug/reviews", validate(listReviewSchema), listReviews);
router.post("/:slug/reviews", authCheck, validate(saveReviewSchema), saveReview);

export const productRoutes = router;
