import { RequestHandler } from "express";
import { ZodSchema } from "zod";

// Zod schema runner. body/query/params teeno validate (parseAsync -> async refine support).
// Validation fail pe raw ZodError next ko jaata hai -> error.ts use clean 400 me convert karta hai.
type ParsedRequestData = {
  body?: unknown;
  query?: unknown;
  params?: unknown;
};

export function validate(schema: ZodSchema): RequestHandler {
  return async (req, _res, next) => {
    try {
      const parsed = (await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      })) as ParsedRequestData;

      if (parsed.body) req.body = parsed.body;
      if (parsed.query) req.query = parsed.query as typeof req.query;
      if (parsed.params) req.params = parsed.params as typeof req.params;

      return next();
    } catch (error) {
      return next(error);
    }
  };
}
