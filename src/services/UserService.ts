import { prisma } from '../config/db'
import { AppError } from '../utils/AppError'
import { Prisma } from '@prisma/client'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'

export const userService = {

  async getProfile(userId: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, isDeleted: false }, // IMPROVED
      include: { addresses: true },
    })

    if (!user) throw new AppError('User not found', 404)
    return user
  },

  async updateProfile(userId: string, data: Prisma.UserUpdateInput) {
    try {
      // IMPROVED: Pehle check karo user exist karta hai aur delete toh nahi hua
      const user = await prisma.user.findFirst({ where: { id: userId, isDeleted: false } })
      if (!user) throw new AppError('User not found or deleted', 404)

      return await prisma.user.update({
        where: { id: userId },
        data,
      })
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new AppError('Email already in use', 409)
      }
      throw err
    }
  },

  async addAddress(userId: string, data: Prisma.AddressUncheckedCreateInput) {
    // IMPROVED: Transaction use kiya taaki race condition me 2 default address na ban jayein
    return prisma.$transaction(async (tx) => {
      // Agar pehla address hai, toh usko automatically default bana do
      const count = await tx.address.count({ where: { userId } })
      if (count === 0) {
        data.isDefault = true
      }

      if (data.isDefault) {
        await tx.address.updateMany({
          where: { userId },
          data: { isDefault: false },
        })
      }

      return tx.address.create({
        data: { ...data, userId },
      })
    })
  },

  async deleteAddress(userId: string, addressId: string) {
    // IMPROVED: Find aur Delete ko ek hi step me kar diya (Transactional & Safe)
    const result = await prisma.address.deleteMany({
      where: { id: addressId, userId },
    })

    if (result.count === 0) throw new AppError('Address not found', 404)
  },
}