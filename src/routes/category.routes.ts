import { Router } from "express";
import { getCategoryTree } from "../controller/category.controller";

const router = Router();

// Public — category + subcategory tree (nav/home ke liye).
router.get("/", getCategoryTree);

export const categoryRoutes = router;
