import { Request, Response } from 'express'
import { asyncHandler } from '../utils/AsyncHandler'
import { orderService } from '../services/OrderService'
import { AppError } from '../utils/AppError'

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError('Unauthorized', 401)

  const { addressId, paymentMethod } = req.body as {
    addressId: string
    paymentMethod: 'COD' | 'ONLINE'
  }

  const order = await orderService.createOrder(
    req.user.userId,
    addressId,
    paymentMethod
  )

  res.status(201).json({
    success: true,
    message:
      paymentMethod === 'ONLINE'
        ? 'Order created. Complete payment to confirm.'
        : 'Order placed successfully',
    order,
  })
})

export const getMyOrders = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError('Unauthorized', 401)
  const orders = await orderService.getUserOrders(req.user.userId)
  res.json({ success: true, orders })
})

export const getOrderDetails = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError('Unauthorized', 401)
  const order = await orderService.getOrderById(req.user.userId, req.params.id as string)
  res.json({ success: true, order })
})

export const updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.updateOrderStatus(req.params.id as string, req.body.status)
  res.json({ success: true, message: 'Order status updated', order })
})