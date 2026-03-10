import Razorpay from 'razorpay'
import crypto from 'crypto'
import { env } from '../config/env'

const razorpay = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID || '',
  key_secret: env.RAZORPAY_KEY_SECRET || '',
})

export const paymentService = {
  async createRazorpayOrder(amount: number, orderId: string) {
    return razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: orderId,
      notes: { orderId },
    })
  },

  verifySignature(rawBody: Buffer, signature: string) {
    const expected = crypto
      .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET || '')
      .update(rawBody)
      .digest('hex')

    return expected === signature
  },
}