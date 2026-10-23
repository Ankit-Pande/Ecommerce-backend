import { RequestHandler, Router } from "express";
import { getCatalog } from "../controller/catalog.controller";
import { rateLimiter } from "../middleware/rateLimiter";
import { validate } from "../middleware/validate";
import { catalogSchema } from "../validation/catalog.validation";

const router = Router();

const searchLimiter = rateLimiter({ name: "catalog-search", seconds: 60, maxRequests: 30, allowIfRedisDown: true });

// Applies the search limit only to text searches (?q=); browsing a category is not limited by it.
const limitSearchOnly: RequestHandler = (req, res, next) => {
  if (req.query.q) {
    return searchLimiter(req, res, next);
  }
  next();
};

router.get("/", limitSearchOnly, validate(catalogSchema), getCatalog);

export const catalogRoutes = router;
