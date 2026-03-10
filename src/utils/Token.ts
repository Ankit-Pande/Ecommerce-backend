import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { AppError } from './AppError'
import { env } from '../config/env'
import { Role } from '@prisma/client'

export interface TokenPayload {
  userId: string
  role: Role
  jti: string 
}

export const generateJti = (): string => crypto.randomBytes(16).toString('hex')

export const signAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: '15m' })
}

export const signRefreshToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: '7d' })
}

export const verifyAccessToken = (token: string): TokenPayload => {
  try { 
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload 
  } catch (err: any) { 
    if (err.name === 'TokenExpiredError') {
      throw new AppError('Token expired', 401)
    }
    throw new AppError('Invalid token', 401)
  }
}

export const verifyRefreshToken = (token: string): TokenPayload => {
  try { 
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload 
  } catch (err: any) { 
    if (err.name === 'TokenExpiredError') {
      throw new AppError('Refresh token expired', 401)
    }
    throw new AppError('Invalid refresh token', 401)
  }
}