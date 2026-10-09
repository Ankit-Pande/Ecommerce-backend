import { NextFunction, Request, RequestHandler, Response } from "express";

type AsyncController = (req: Request, res: Response, next: NextFunction) => Promise<void>;

// Controller me error aaye to seedha error middleware tak bhejo; har jagah try/catch nahi likhna padta.
export function asyncHandler(fn: AsyncController): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
