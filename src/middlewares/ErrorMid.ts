import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import multer from 'multer'
import { AppError } from '../utils/AppError'
import { logger } from '../config/winston'

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {

  // Zod validation error
  if (err instanceof ZodError) {
    const message = err.issues
      .map(issue => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ')

    return res.status(400).json({
      success: false,
      message,
    })
  }

  // Multer (file upload) error
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Max size is 2MB.',
      })
    }

    return res.status(400).json({
      success: false,
      message: err.message,
    })
  }

  // Custom AppError
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    })
  }

  // Unknown error
  logger.error('Unexpected error', {
    error: err instanceof Error ? err.message : err,
  })

  return res.status(500).json({
    success: false,
    message: 'Internal server error',
  })
}