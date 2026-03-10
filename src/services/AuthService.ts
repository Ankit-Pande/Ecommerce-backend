import { prisma } from '../config/db'
import { otpService } from './OtpService'
import { tokenService } from './TokenService'
import { verifyRefreshToken } from '../utils/Token'
import { Role } from '@prisma/client'
import { AppError } from '../utils/AppError'

export const authService = {
  async requestOtp(phone: string) {
    await otpService.sendOtp(phone)
  },

  async verifyOtpAndLogin(phone: string, otp: string) {
    await otpService.verifyOtp(phone, otp)

    let user = await prisma.user.findUnique({ where: { phone } })

    // Security check
    if (user?.isBlocked || user?.isDeleted) {
      throw new AppError('Account blocked or deleted', 403)
    }

    if (!user) {
      user = await prisma.user.create({
        data: { phone, role: Role.USER },
      })
    }

    // Naya login hone par purane sab devices se logout kar do
    await tokenService.revokeAllSessions(user.id)

    const tokens = await tokenService.createSession(user.id, user.role)
    return { user, ...tokens }
  },

  async refreshSession(token: string) {
    return tokenService.refreshSession(token)
  },

  async logout(token: string) {
    const payload = verifyRefreshToken(token)
    if (payload) {
      await tokenService.revokeSession(payload.userId, payload.jti)
    }
  },
}