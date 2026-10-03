import { RequestHandler, Router } from "express";
import { getCatalog, getFilters } from "../controller/catalog.controller";
import { rateLimiter } from "../middleware/rateLimiter";
import { validate } from "../middleware/validate";
import { catalogFiltersSchema, catalogSchema } from "../validation/catalog.validation";

const router = Router();

// Search (q) wali request par alag limit — har naya search DB tak jaata hai.
const searchLimiter = rateLimiter({
  bucket: "catalog-search",
  windowSec: 60,
  max: 30,
  allowOnRedisDown: true,
});
const limitSearchOnly: RequestHandler = (req, res, next) =>
  req.query.q ? searchLimiter(req, res, next) : next();

router.get("/filters", validate(catalogFiltersSchema), getFilters);
router.get("/", limitSearchOnly, validate(catalogSchema), getCatalog);

export const catalogRoutes = router;
