import { z } from 'zod'

const UUID = z.string().uuid('Invalid ID format')

export const addToCartSchema = z.object({
  body: z.object({
    productId: UUID,
    quantity: z.coerce.number().int().min(1).default(1),
  }),
})

export const updateCartItemSchema = z.object({
  params: z.object({ id: UUID }), 
  body: z.object({
    quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
  }),
})

export const removeCartItemSchema = z.object({
  params: z.object({ id: UUID }),
})