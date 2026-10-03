import { RequestHandler } from "express";
import { ZodSchema } from "zod";

type ParsedRequest = { body?: unknown; query?: unknown; params?: unknown };

// Zod se body/query/params check karo aur saaf data wapas req par rakho.
export function validate(schema: ZodSchema): RequestHandler {
  return async (req, _res, next) => {
    try {
      const parsed = (await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      })) as ParsedRequest;

      if (parsed.body !== undefined) req.body = parsed.body;
      if (parsed.query !== undefined) req.query = parsed.query as typeof req.query;
      if (parsed.params !== undefined) Object.assign(req.params, parsed.params);
      next();
    } catch (error) {
      next(error);
    }
  };
}
