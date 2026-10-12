import { Prisma, PrismaClient } from "@prisma/client";
import { AppError } from "../utils/appError";

export const prisma = new PrismaClient({
  log: ["warn", "error"],
  transactionOptions: { maxWait: 10_000, timeout: 20_000 },
});

export async function lockUser(db: Prisma.TransactionClient, userId: string) {
  const [user] = await db.$queryRaw<{ isBlocked: boolean; isDeleted: boolean }[]>`
    SELECT "isBlocked", "isDeleted" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
  if (!user || user.isDeleted) throw new AppError("Account deleted", 403);
  if (user.isBlocked) throw new AppError("User blocked", 403);
}

export async function lockProduct(db: Prisma.TransactionClient, productId: string) {
  await db.$queryRaw`SELECT "id" FROM "Product" WHERE "id" = ${productId} FOR UPDATE`;
}
