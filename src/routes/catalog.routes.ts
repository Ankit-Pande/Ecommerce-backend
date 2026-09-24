import { RequestHandler, Router } from "express";
import { getCatalog, getFilters } from "../controller/catalog.controller";
import { rateLimiter } from "../middleware/rateLimiter";
import { validate } from "../middleware/validate";
import { catalogFiltersSchema, catalogSchema } from "../validation/catalog.validation";

const router = Router();

// Bina search ke listing cache se aati hai, par har naya search text DB tak jaata hai —
// isliye sirf search wali request par alag limit.
const searchLimiter = rateLimiter({
  bucket: "catalog-search",
  windowSec: 60,
  max: 30,
  allowOnRedisDown: true,
});
const limitSearchOnly: RequestHandler = (req, res, next) =>
  req.query.q ? searchLimiter(req, res, next) : next();

// Public: listing/search aur sidebar ke filter options.
router.get("/filters", validate(catalogFiltersSchema), getFilters);
router.get("/", limitSearchOnly, validate(catalogSchema), getCatalog);

export const catalogRoutes = router;
