import { Prisma } from "@prisma/client";
import { prisma } from "../config/db";
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

// Ek hi address default reh sake — naya default set karte hi baaki false.
async function clearOtherDefaults(
  tx: Prisma.TransactionClient,
  userId: string,
  exceptId?: string
) {
  await tx.address.updateMany({
    where: { userId, isDefault: true, ...(exceptId && { id: { not: exceptId } }) },
    data: { isDefault: false },
  });
}

export const addressService = {
  async list(userId: string) {
    return prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
  },

  async create(userId: string, data: AddressInput) {
    return prisma.$transaction(async (tx) => {
      // Max 5 address per user (delivery ke liye kaafi, DB saaf rahe).
      const count = await tx.address.count({ where: { userId } });
      if (count >= 5) {
        throw new AppError("Maximum 5 addresses allowed. Delete one first.", 400);
      }

      // Pehla address apne aap default ban jaye.
      const makeDefault = data.isDefault || count === 0;

      if (makeDefault) await clearOtherDefaults(tx, userId);

      return tx.address.create({
        data: { ...data, userId, isDefault: makeDefault },
      });
    });
  },

  async update(userId: string, id: string, data: Partial<AddressInput>) {
    const existing = await prisma.address.findFirst({ where: { id, userId } });
    if (!existing) throw new AppError("Address not found", 404);

    return prisma.$transaction(async (tx) => {
      if (data.isDefault) await clearOtherDefaults(tx, userId, id);
      return tx.address.update({ where: { id }, data });
    });
  },

  async remove(userId: string, id: string) {
    const existing = await prisma.address.findFirst({ where: { id, userId } });
    if (!existing) throw new AppError("Address not found", 404);
    await prisma.address.delete({ where: { id } });
  },
};
