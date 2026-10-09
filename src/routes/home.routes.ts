import { Router } from "express";
import { getHome } from "../controller/home.controller";

const router = Router();

router.get("/", getHome);

export const homeRoutes = router;
