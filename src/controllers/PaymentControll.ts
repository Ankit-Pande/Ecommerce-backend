import { Request, Response } from 'express'
import { asyncHandler } from '../utils/AsyncHandler'
import { paymentService } from '../services/PaymentService'
import { prisma } from '../config/db'
import { cartService } from '../services/CartService'
import { PaymentStatus, OrderStatus } from '@prisma/client'

export const handleRazorpayWebhook = asyncHandler(async (req: Request, res: Response) => {
  const signature = req.headers['x-razorpay-signature']

  if (typeof signature !== 'string') {
    return res.status(400).json({ success: false, message: 'Missing signature' })
  }

  const rawBody = req.body as Buffer

  if (!paymentService.verifySignature(rawBody, signature)) {
    return res.status(400).json({ success: false, message: 'Invalid signature' })
  }

  const payload = JSON.parse(rawBody.toString('utf8')) as {
    event?: string
    payload?: {
      payment?: {
        entity?: {
          id: string
          order_id: string
        }
      }
    }
  }

  if (payload.event === 'payment.captured') {
    const payment = payload.payload?.payment?.entity

    if (payment?.order_id && payment?.id) {
      const order = await prisma.order.update({
        where: { razorpayOrderId: payment.order_id },
        data: {
          paymentStatus: PaymentStatus.COMPLETED,
          orderStatus: OrderStatus.PROCESSING,
          razorpayPaymentId: payment.id,
        },
      })

      await prisma.cartItem.deleteMany({
        where: {
          cart: { userId: order.userId },
        },
      })

      await cartService.clearCartCache(order.userId)
    }
  }

  if (payload.event === 'payment.failed') {
    const payment = payload.payload?.payment?.entity

    if (payment?.order_id) {
      await prisma.order.update({
        where: { razorpayOrderId: payment.order_id },
        data: {
          paymentStatus: PaymentStatus.FAILED,
        },
      })
    }
  }

  return res.json({ success: true })
})