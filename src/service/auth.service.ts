import { Role } from "@prisma/client";
import { env } from "../config/env";
import { prisma } from "../config/db";
import { AppError } from "../utils/appError";
import { otpService } from "./otp.service";
import { tokenService } from "./token.service";

// "+91 98765-43210" -> "9876543210", taaki ek number ke do account na banein.
const normalizePhone = (phone: string) => phone.replace(/\D/g, "").slice(-10);

export const authService = {
  // OTP bhejo (blocked number ko nahi).
  async requestOtp(phone: string): Promise<void> {
    const cleanPhone = normalizePhone(phone);
    const user = await prisma.user.findUnique({
      where: { phone: cleanPhone },
      select: { isBlocked: true },
    });
    if (user?.isBlocked) throw new AppError("Account unavailable", 403);

    await otpService.send(cleanPhone);
  },

  // OTP sahi ho to user dhundo ya banao, aur login session do.
  async verifyOtpAndLogin(phone: string, otp: string) {
    const cleanPhone = normalizePhone(phone);
    await otpService.verify(cleanPhone, otp);

    const isSuperAdmin = cleanPhone === env.SUPER_ADMIN_PHONE;
    const user = await prisma.user.upsert({
      where: { phone: cleanPhone },
      create: { phone: cleanPhone, role: isSuperAdmin ? Role.SUPER_ADMIN : Role.USER },
      update: isSuperAdmin ? { role: Role.SUPER_ADMIN } : {},
    });
    if (user.isBlocked || user.isDeleted) throw new AppError("Account unavailable", 403);

    const tokens = await tokenService.createSession(user.id);
    return { user, ...tokens };
  },
};
