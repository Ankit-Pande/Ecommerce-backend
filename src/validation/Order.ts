import { z } from 'zod'
import { OrderStatus } from '@prisma/client'

const UUID = z.string().uuid('Invalid ID format')

export const createOrderSchema = z.object({
  body: z.object({
    addressId: UUID,
    paymentMethod: z.enum(['COD', 'ONLINE']).default('ONLINE'),
  }),
})

export const updateOrderStatusSchema = z.object({
  params: z.object({ id: UUID }),
  body: z.object({
    status: z.nativeEnum(OrderStatus),
  }),
})