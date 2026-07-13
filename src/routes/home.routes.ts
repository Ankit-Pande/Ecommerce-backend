import { Router } from "express";
import { getHome } from "../controller/home.controller";

const router = Router();

// Public — home page ka pura data ek API me.
router.get("/", getHome);

export const homeRoutes = router;
