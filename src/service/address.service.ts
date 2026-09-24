import { prisma, lockUser } from "../config/db";
import { AppError } from "../utils/appError";

type AddressInput = {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
};

const MAX_ADDRESSES = 5;

// Har write user lock ke andar — ek hi waqt me do default address na ban jayein.
export const addressService = {
  async list(userId: string) {
    return prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
  },

  // Pehla address apne aap default.
  async create(userId: string, data: AddressInput) {
    return prisma.$transaction(async (tx) => {
      await lockUser(tx, userId);
      const count = await tx.address.count({ where: { userId } });
      if (count >= MAX_ADDRESSES) {
        throw new AppError("Maximum 5 addresses allowed. Delete one first.", 400);
      }

      const isDefault = data.isDefault === true || count === 0;
      if (isDefault) {
        await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
      }
      return tx.address.create({ data: { ...data, userId, isDefault } });
    });
  },

  async update(userId: string, id: string, data: Partial<AddressInput>) {
    return prisma.$transaction(async (tx) => {
      await lockUser(tx, userId);
      const existing = await tx.address.findFirst({ where: { id, userId } });
      if (!existing) throw new AppError("Address not found", 404);
      // User bina default address ke na rahe.
      if (existing.isDefault && data.isDefault === false) {
        throw new AppError("Set another address as default first", 400);
      }

      if (data.isDefault) {
        await tx.address.updateMany({
          where: { userId, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }
      return tx.address.update({ where: { id }, data });
    });
  },

  // Default address hataya to sabse naya wala default ban jaata hai.
  async remove(userId: string, id: string) {
    await prisma.$transaction(async (tx) => {
      await lockUser(tx, userId);
      const existing = await tx.address.findFirst({ where: { id, userId } });
      if (!existing) throw new AppError("Address not found", 404);
      await tx.address.delete({ where: { id } });

      if (!existing.isDefault) return;
      const next = await tx.address.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
      if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
    });
  },
};
