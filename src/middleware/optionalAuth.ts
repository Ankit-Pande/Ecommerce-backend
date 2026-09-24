import { RequestHandler } from "express";
import { authCheck } from "./authCheck";

// Guest bhi chalega. Token bheja hai to wo sahi hona chahiye — galat token guest nahi banta.
export const optionalAuth: RequestHandler = (req, res, next) => {
  if (req.headers.authorization === undefined) return next();
  return authCheck(req, res, next);
};
