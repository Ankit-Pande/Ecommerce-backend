import { lockUser, prisma } from "../config/db";
import { AppError } from "../utils/appError";

const MAX_ADDRESSES = 5;

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

export const addressService = {
  // The user's addresses, default first.
  async list(userId: string) {
    return prisma.address.findMany({ where: { userId }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] });
  },

  // Adds an address; the first one (or one marked default) becomes the default.
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

  // Changes an address; there is always exactly one default.
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

  // Deletes an address; if it was the default, the newest other address becomes the default.
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
