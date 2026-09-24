import { Router } from "express";
import { getHome } from "../controller/home.controller";

const router = Router();

// Public — home page ka saara data ek call me.
router.get("/", getHome);

export const homeRoutes = router;
