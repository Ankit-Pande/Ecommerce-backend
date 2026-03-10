import { z } from 'zod'

const phoneRegex = /^\+[1-9]\d{7,14}$/

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, 'Name too short').max(50, 'Name too long').optional(),
    email: z.string().trim().email('Invalid email').max(100).optional(),
  }),
})

export const addressSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1, 'Title required'),
    receiverName: z.string().trim().min(1, 'Receiver name required'),
    receiverPhone: z.string().trim().regex(phoneRegex, 'Invalid phone format'),
    line1: z.string().trim().min(1, 'Address line 1 required'),
    line2: z.string().trim().optional(),
    city: z.string().trim().min(1, 'City required'),
    state: z.string().trim().min(1, 'State required'),
    zip: z.string().trim().min(1, 'ZIP code required'),
    country: z.string().trim().default('India'),
    isDefault: z.boolean().optional(),
  }),
})

export const addressIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid address id format'),
  }),
})