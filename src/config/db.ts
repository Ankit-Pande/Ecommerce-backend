import { Prisma, PrismaClient } from "@prisma/client";
import { logger } from "./winston";
import { AppError } from "../utils/appError";

export const prisma = new PrismaClient({ log: ["warn", "error"] });

// Server start hote hi DB se jodo; na jude to app band.
export async function connectDB(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info("Database connected");
  } catch (error) {
    logger.error("Database connection failed", { error });
    process.exit(1);
  }
}

// Server band hote waqt DB connection band karo.
export async function disconnectDB(): Promise<void> {
  await prisma.$disconnect().catch((error) => logger.error("Database disconnect failed", { error }));
}

// Ek user ki requests ek-ek karke chalao (user ki row lock); user blocked ya deleted ho to roko.
export async function lockUser(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  const [user] = await tx.$queryRaw<{ isBlocked: boolean; isDeleted: boolean }[]>`
    SELECT "isBlocked", "isDeleted" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
  if (!user || user.isDeleted) throw new AppError("Account deleted", 403);
  if (user.isBlocked) throw new AppError("User blocked", 403);
}
