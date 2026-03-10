import { Request, Response } from 'express'
import { asyncHandler } from '../utils/AsyncHandler'
import { cartService } from '../services/CartService'
import { AppError } from '../utils/AppError'

export const getCart = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError('Unauthorized', 401)
  const cart = await cartService.getCart(req.user.userId)
  res.json({ success: true, cart })
})

export const addItemToCart = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError('Unauthorized', 401)
  const { productId, quantity } = req.body
  const cart = await cartService.addItem(req.user.userId, productId, quantity)
  res.json({ success: true, message: 'Item added to cart', cart })
})

export const updateItemQuantity = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError('Unauthorized', 401)
  const cartItemId = req.params.id as string
  const { quantity } = req.body
  const cart = await cartService.updateItemQuantity(req.user.userId, cartItemId, quantity)
  res.json({ success: true, message: 'Cart updated', cart })
})

export const removeItemFromCart = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError('Unauthorized', 401)
  const cartItemId = req.params.id as string
  const cart = await cartService.removeItem(req.user.userId, cartItemId)
  res.json({ success: true, message: 'Item removed from cart', cart })
})