import { prisma } from "../config/db";
import { AppError } from "../utils/appError";

export const userService = {
  // Apna profile dekho.
  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true, name: true, email: true, createdAt: true },
    });
    if (!user) throw new AppError("User not found", 404);
    return user;
  },

  // Naam/email update. Email kisi aur ka ho to saaf error.
  async updateMe(userId: string, data: { name?: string; email?: string }) {
    if (data.email) {
      const taken = await prisma.user.findFirst({
        where: { email: data.email, id: { not: userId } },
        select: { id: true },
      });
      if (taken) throw new AppError("Email already in use", 409);
    }

    return prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, phone: true, name: true, email: true },
    });
  },
};
