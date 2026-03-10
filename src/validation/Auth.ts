import { z } from 'zod'

const phoneRegex = /^\+[1-9]\d{7,14}$/

export const sendOtpSchema = z.object({
  body: z.object({
    phone: z.string().trim().regex(phoneRegex, 'Invalid phone format (example: +919876543210)'),
  }).strict(),
})

export const verifyOtpSchema = z.object({
  body: z.object({
    phone: z.string().trim().regex(phoneRegex, 'Invalid phone format'),
    otp: z.string().regex(/^\d{6}$/, 'OTP must be exactly 6 digits'),
  }).strict(),
})