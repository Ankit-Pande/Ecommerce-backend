import { NextFunction, Request, RequestHandler, Response } from "express";

type AsyncController = (req: Request, res: Response, next: NextFunction) => Promise<void>;

// Controller ki error seedha error middleware tak — har jagah try/catch nahi likhna padta.
export function asyncHandler(fn: AsyncController): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
