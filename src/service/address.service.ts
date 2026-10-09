import { prisma, lockUser } from "../config/db";
import { AppError } from "../utils/appError";

type AddressInput = {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
};

const MAX_ADDRESSES = 5;

export const addressService = {
  // User ke saare address (default pehle).
  async list(userId: string) {
    return prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
  },

  // Naya address (max 5, pehla apne aap default).
  async create(userId: string, data: AddressInput) {
    return prisma.$transaction(async (db) => {
      await lockUser(db, userId);
      const count = await db.address.count({ where: { userId } });
      if (count >= MAX_ADDRESSES) {
        throw new AppError("Maximum 5 addresses allowed. Delete one first.", 400);
      }

      const isDefault = data.isDefault === true || count === 0;
      if (isDefault) {
        await db.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
      }
      return db.address.create({ data: { ...data, userId, isDefault } });
    });
  },

  // Address badlo; default address ko seedha non-default nahi kar sakte (pehle doosra default chuno).
  async update(userId: string, id: string, data: Partial<AddressInput>) {
    return prisma.$transaction(async (db) => {
      await lockUser(db, userId);
      const address = await db.address.findFirst({ where: { id, userId } });
      if (!address) throw new AppError("Address not found", 404);
      if (address.isDefault && data.isDefault === false) {
        throw new AppError("Set another address as default first", 400);
      }

      if (data.isDefault) {
        await db.address.updateMany({
          where: { userId, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }
      return db.address.update({ where: { id }, data });
    });
  },

  // Address hatao; default hataya to sabse naya default ban jaata hai.
  async remove(userId: string, id: string) {
    await prisma.$transaction(async (db) => {
      await lockUser(db, userId);
      const address = await db.address.findFirst({ where: { id, userId } });
      if (!address) throw new AppError("Address not found", 404);
      await db.address.delete({ where: { id } });

      if (!address.isDefault) return;
      const newest = await db.address.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
      if (newest) await db.address.update({ where: { id: newest.id }, data: { isDefault: true } });
    });
  },
};
