import { NextFunction, Request, RequestHandler, Response } from "express";

// Async controller wrapper — try/catch baar baar nahi. Reject/throw -> error middleware.
type AsyncFunction = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;

export function asyncHandler(fn: AsyncFunction): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
