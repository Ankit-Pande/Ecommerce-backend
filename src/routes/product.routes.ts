import { Router } from "express";
import { listProducts, getProduct, getFacets } from "../controller/product.controller";
import { validate } from "../middleware/validate";
import {
  listProductSchema,
  productSlugSchema,
  productFacetsSchema,
} from "../validation/product.validation";

const router = Router();

// Sab public (browse karne ke liye login zaroori nahi).
router.get("/", validate(listProductSchema), listProducts);
// /facets — /:slug se PEHLE (warna "facets" ko slug samajh lega).
router.get("/facets", validate(productFacetsSchema), getFacets);
router.get("/:slug", validate(productSlugSchema), getProduct);

export const productRoutes = router;
