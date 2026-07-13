import { Router } from "express";
import { getBrands } from "../controller/brand.controller";

const router = Router();

// Public — brand filter list.
router.get("/", getBrands);

export const brandRoutes = router;
