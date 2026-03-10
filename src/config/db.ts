import { PrismaClient } from '@prisma/client'
import { env } from './env'
import { logger } from './winston'


export const globalForPrisma = globalThis as { prisma? : PrismaClient}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: ['warn' , 'error'],
})

if (env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export const connectDB = async () => {
  try {
    await prisma.$connect()
    logger.info('Database connected')
  } catch (err) {
    logger.error('Database connection failed', {err})
    process.exit(1)
  }
}

export const disconnectDB = async () => {
  await prisma.$disconnect()
}