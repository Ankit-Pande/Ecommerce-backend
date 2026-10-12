import { Role } from "@prisma/client";
import { prisma } from "../config/db";
import { env } from "../config/env";
import { AppError } from "../utils/appError";
import { otpService } from "./otp.service";
import { tokenService } from "./token.service";

const cleanPhone = (phone: string) => phone.replace(/\D/g, "").slice(-10);

export const authService = {
  async requestOtp(phone: string) {
    const mobile = cleanPhone(phone);
    const user = await prisma.user.findUnique({ where: { phone: mobile }, select: { isBlocked: true } });
    if (user?.isBlocked) throw new AppError("Account unavailable", 403);

    await otpService.send(mobile);
  },

  async verifyOtpAndLogin(phone: string, otp: string) {
    const mobile = cleanPhone(phone);
    await otpService.verify(mobile, otp);

    const isSuperAdmin = mobile === env.SUPER_ADMIN_PHONE;
    const { isBlocked, isDeleted, ...user } = await prisma.user.upsert({
      where: { phone: mobile },
      create: { phone: mobile, role: isSuperAdmin ? Role.SUPER_ADMIN : Role.USER },
      update: isSuperAdmin ? { role: Role.SUPER_ADMIN } : {},
      select: {
        id: true,
        phone: true,
        name: true,
        email: true,
        alternatePhone: true,
        role: true,
        isBlocked: true,
        isDeleted: true,
      },
    });
    if (isBlocked || isDeleted) throw new AppError("Account unavailable", 403);

    const tokens = await tokenService.createSession(user.id);
    return { user, ...tokens };
  },
};
