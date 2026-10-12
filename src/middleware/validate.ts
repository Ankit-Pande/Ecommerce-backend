import { RequestHandler } from "express";
import { ZodSchema } from "zod";

export function validate(schema: ZodSchema): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse({ body: req.body, query: req.query, params: req.params });
    if (!result.success) return next(result.error);

    const { body, query, params } = result.data;
    if (body !== undefined) req.body = body;
    if (query !== undefined) req.query = query;
    if (params !== undefined) Object.assign(req.params, params);
    next();
  };
}
