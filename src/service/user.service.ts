import { prisma } from "../config/db";
import { AppError } from "../utils/appError";
import { tokenService } from "./token.service";

const PROFILE_SELECT = {
  id: true,
  phone: true,
  alternatePhone: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
};

export const userService = {
  // Apni profile.
  async getMe(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: PROFILE_SELECT });
    if (!user) throw new AppError("User not found", 404);
    return user;
  },

  // Profile badlo (email kisi aur ka ho to 409).
  async updateMe(userId: string, data: { name?: string; email?: string; alternatePhone?: string | null }) {
    return prisma.user.update({ where: { id: userId }, data, select: PROFILE_SELECT });
  },

  // Account delete: orders bache rahein, personal data mite, number dobara use ho sake.
  async deleteAccount(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user) throw new AppError("User not found", 404);
    if (user.role === "SUPER_ADMIN") throw new AppError("Super admin account cannot be deleted", 403);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          isDeleted: true,
          isBlocked: true,
          name: null,
          email: null,
          alternatePhone: null,
          phone: `deleted_${userId}`,
        },
      }),
      prisma.address.deleteMany({ where: { userId } }),
      prisma.cart.deleteMany({ where: { userId } }),
    ]);
    await tokenService.logoutAllDevices(userId);
  },
};
