import { RequestHandler } from 'express'
import { Role } from '@prisma/client'
import { AppError } from '../utils/AppError'

export const roleCheck = (...allowedRoles: Role[]): RequestHandler => {
  return (req, _res, next) => {
    if (!req.user) return next(new AppError('Unauthorized', 401))

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('Forbidden: Insufficient permissions', 403))
    }

    next()
  }
}