import { RequestHandler } from 'express'
import { ZodSchema } from 'zod'

export const validate = (schema: ZodSchema): RequestHandler => async (req, _res, next) => {
  try {
    const validData = await schema.parseAsync({
      body: req.body,
      query: req.query,
      params: req.params,
    }) as Record<'body' | 'query' | 'params', unknown>
    
    for (const key of ['body', 'query', 'params'] as const) {
      if (validData[key]) {
        Object.defineProperty(req, key, { value: validData[key], writable: true, configurable: true })
      }
    }
    
    next()
  } catch (err) {
    next(err)
  }
}
