import { Request, Response } from 'express'
import { asyncHandler } from '../utils/AsyncHandler'
import { authService } from '../services/AuthService'
import { setAuthCookies, clearAuthCookies } from '../utils/Cookies'
import { AppError } from '../utils/AppError'

export const sendOtp = asyncHandler(async (req: Request, res: Response) => {
  const phone = req.body.phone.trim() // IMPROVED: Normalization
  await authService.requestOtp(phone)
  res.json({ success: true, message: 'OTP sent successfully' })
})

export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const phone = req.body.phone.trim() // IMPROVED: Normalization
  const { user, accessToken, refreshToken } = await authService.verifyOtpAndLogin(phone, req.body.otp)
  
  setAuthCookies(res, accessToken, refreshToken)
  res.json({ success: true, user })
})

export const refreshTokens = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken
  if (!token) throw new AppError('Unauthorized', 401)

  const { accessToken, refreshToken } = await authService.refreshSession(token)
  setAuthCookies(res, accessToken, refreshToken)
  res.json({ success: true })
})

export const logout = asyncHandler(async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.refreshToken
    if (token) await authService.logout(token)
  } catch (error) {
    // IMPROVED: Agar token galat hai ya Redis down hai, toh bhi error ignore karo aur cookie clear karo
  } finally {
    clearAuthCookies(res)
    res.json({ success: true, message: 'Logged out successfully' })
  }
})