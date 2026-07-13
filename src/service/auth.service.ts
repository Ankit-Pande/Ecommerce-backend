import { Role } from "@prisma/client";
import { prisma } from "../config/db";
import { AppError } from "../utils/appError";
import { verifyRefreshToken } from "../utils/token";
import { otpService } from "./otp.service";
import { tokenService } from "./token.service";

// Phone ko ek hi canonical format me lao (DB me consistent rahe -> duplicate user na bane).
// "9876543210" / "+919876543210" / "919876543210" -> "919876543210"
const normalizePhone = (phone: string): string => {
  const p = phone.trim().replace(/[\s\-+]/g, "");
  return p.length === 10 ? `91${p}` : p;
};

export const authService = {
  async requestOtp(phone: string): Promise<void> {
    await otpService.sendOtp(normalizePhone(phone));
  },

  async verifyOtpAndLogin(phone: string, otp: string) {
    const cleanPhone = normalizePhone(phone);
    await otpService.verifyOtp(cleanPhone, otp);

    // Find-or-create. Race condition (do parallel verify) me create fail ho to dobara fetch.
    let user = await prisma.user.findUnique({ where: { phone: cleanPhone } });

    if (!user) {
      try {
        user = await prisma.user.create({
          data: { phone: cleanPhone, role: Role.USER },
        });
      } catch {
        user = await prisma.user.findUnique({ where: { phone: cleanPhone } });
      }
    }

    if (!user) throw new AppError("Unable to login user", 500);
    if (user.isBlocked) throw new AppError("Account blocked by admin", 403);

    // Multi-device allowed — login pe purane sessions nahi kaatte.
    const { accessToken, refreshToken } = await tokenService.createSession(
      user.id,
      user.role
    );

    return { user, accessToken, refreshToken };
  },

  async refreshSession(refreshToken: string) {
    return tokenService.refreshSession(refreshToken);
  },

  async logout(refreshToken: string): Promise<void> {
    const payload = verifyRefreshToken(refreshToken);
    await tokenService.revokeSession(payload.userId, payload.jti);
  },
};
