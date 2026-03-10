import { RequestHandler } from 'express'
import { verifyAccessToken, TokenPayload } from '../utils/Token'
import { AppError } from '../utils/AppError'
import { tokenService } from '../services/TokenService'

declare module 'express-serve-static-core' {
  interface Request {
    user?: TokenPayload
  }
}

export const authCheck: RequestHandler = async (req, _res, next) => {
  try {
    // Token cookie se lo
    let token = req.cookies?.accessToken

    // Agar cookie me nahi mila to header check karo
    if (!token) {
      const authHeader = req.headers.authorization
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1]
      }
    }

    // Agar token hi nahi mila
    if (!token) {
      return next(new AppError('Login required. Token missing!', 401))
    }

    // Token verify karo
    const payload = verifyAccessToken(token)

    // Blacklist check karo
    const isBlacklisted = await tokenService.isAccessBlacklisted(payload.jti)
    if (isBlacklisted) {
      return next(new AppError('Session expired. Please login again.', 401))
    }

    // User set karo
    req.user = payload
    next()

  } catch {
    next(new AppError('Invalid or expired token. Please login again.', 401))
  }
}