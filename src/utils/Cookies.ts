import { Response } from 'express'
import { env } from '../config/env'

const baseOptions = {
  httpOnly: true, // Javascript read nahi kar sakti
  secure: env.NODE_ENV === 'production',
  sameSite: env.NODE_ENV === 'production' ? ('none' as const) : ('lax' as const),
  path: '/',
}

export const setAuthCookies = (res: Response, accessToken: string, refreshToken: string) => {
  res.cookie('accessToken', accessToken, { ...baseOptions, maxAge: 15 * 60 * 1000 })
  res.cookie('refreshToken', refreshToken, { ...baseOptions, maxAge: 7 * 24 * 60 * 60 * 1000 })
}

export const clearAuthCookies = (res: Response) => {
  res.clearCookie('accessToken', baseOptions)
  res.clearCookie('refreshToken', baseOptions)
}