import { Role } from "@prisma/client";
import { env } from "../config/env";
import { prisma } from "../config/db";
import { AppError } from "../utils/appError";
import { otpService } from "./otp.service";
import { tokenService } from "./token.service";

// "+91 98765-43210" / "919876543210" / "9876543210" -> "9876543210"
// Ek number ke do format se do alag user na banein.
const normalizePhone = (phone: string) => phone.replace(/\D/g, "").slice(-10);

export const authService = {
  async requestOtp(phone: string): Promise<void> {
    const cleanPhone = normalizePhone(phone);
    // Blocked number par SMS bhejne ka koi matlab nahi — wo login kar hi nahi payega,
    // aur baar-baar OTP maangkar MSG91 ka bill badha sakta hai.
    const user = await prisma.user.findUnique({
      where: { phone: cleanPhone },
      select: { isBlocked: true },
    });
    if (user?.isBlocked) throw new AppError("Account unavailable", 403);

    await otpService.send(cleanPhone);
  },

  // OTP sahi -> user dhundo ya banao -> nayi session.
  async verifyOtpAndLogin(phone: string, otp: string) {
    const cleanPhone = normalizePhone(phone);
    await otpService.verify(cleanPhone, otp);

    // SUPER_ADMIN_PHONE wala number login karte hi super admin (seed ki zaroorat nahi).
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
