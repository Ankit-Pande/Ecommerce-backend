import { PrismaClient } from "@prisma/client";
import { env } from "./env";
import { logger } from "./winston";

// Single global Prisma client. Dev hot-reload pe duplicate client banne se rokta hai.
// Connection pool Prisma khud manage karta hai — har request pe connect/disconnect NAHI.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["warn", "error"],
  });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Server start pe explicit connect — DB down ho to abhi pata chale, baad me request pe nahi.
export async function connectDB(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info("Database connected");
  } catch (error) {
    logger.error("Database connection failed", { error });
    process.exit(1);
  }
}

// Graceful shutdown pe call hota hai (server.ts me SIGINT/SIGTERM par).
export async function disconnectDB(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info("Database disconnected");
  } catch (error) {
    logger.error("Database disconnect failed", { error });
  }
}
