import { NextFunction, Request, RequestHandler, Response } from "express";

// Wraps an async route handler so a thrown error goes to the error handler instead of crashing the request.
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
