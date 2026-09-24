import { Prisma, PrismaClient } from "@prisma/client";
import { env } from "./env";
import { logger } from "./winston";
import { AppError } from "../utils/appError";

// Ek hi Prisma client. Dev hot-reload pe naya client na bane.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ["warn", "error"] });

if (env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function connectDB(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info("Database connected");
  } catch (error) {
    logger.error("Database connection failed", { error });
    process.exit(1);
  }
}

export async function disconnectDB(): Promise<void> {
  await prisma.$disconnect().catch((error) => {
    logger.error("Database disconnect failed", { error });
  });
}

// User ki row lock karo — ek user ki cart/address/checkout requests ek-ek karke chalein
// (do tab se ek saath click pe ginti galat na ho). Lock ke baad account bhi check.
export async function lockUser(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  const [user] = await tx.$queryRaw<{ isBlocked: boolean; isDeleted: boolean }[]>`
    SELECT "isBlocked", "isDeleted" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
  if (!user || user.isDeleted) throw new AppError("Account deleted", 403);
  if (user.isBlocked) throw new AppError("User blocked", 403);
}
