import { RequestHandler } from 'express'
import crypto from 'crypto'
import { AppError } from '../utils/AppError'
import { env } from '../config/env'

export const generateCsrf: RequestHandler = (req, res) => {

  // Agar pehle se cookie me token hai to wahi return karo
  const existingToken = req.cookies?.csrfToken
  if (existingToken) {
    return res.json({ csrfToken: existingToken })
  }

  // Naya token banao
  const token = crypto.randomBytes(32).toString('hex')

  res.cookie('csrfToken', token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 15 * 60 * 1000,
  })

  res.json({ csrfToken: token })
}

export const verifyCsrf: RequestHandler = (req, _res, next) => {

  // Safe methods skip karo
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next()
  }

  const cookieToken = req.cookies?.csrfToken

  const headerValue = req.headers['x-csrf-token']
  const headerToken = Array.isArray(headerValue) ? headerValue[0] : headerValue

  if (!cookieToken || cookieToken !== headerToken) {
    return next(new AppError('Invalid or Expired CSRF token', 403))
  }

  next()
}