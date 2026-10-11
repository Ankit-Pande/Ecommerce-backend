import { RequestHandler, Router } from "express";
import { getCatalog } from "../controller/catalog.controller";
import { rateLimiter } from "../middleware/rateLimiter";
import { validate } from "../middleware/validate";
import { catalogSchema } from "../validation/catalog.validation";

const router = Router();

// Search wali request par alag limit (minute me 30), kyunki har naya search DB tak jaata hai.
const searchLimiter = rateLimiter({
  name: "catalog-search",
  seconds: 60,
  maxRequests: 30,
  allowIfRedisDown: true,
});
const limitSearchOnly: RequestHandler = (req, res, next) =>
  req.query.q ? searchLimiter(req, res, next) : next();

router.get("/", limitSearchOnly, validate(catalogSchema), getCatalog);

export const catalogRoutes = router;
