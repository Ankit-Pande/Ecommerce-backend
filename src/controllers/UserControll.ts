import { Request, Response } from 'express'
import { asyncHandler } from '../utils/AsyncHandler'
import { userService } from '../services/UserService'
import { AppError } from '../utils/AppError'

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError('Unauthorized', 401)
  const user = await userService.getProfile(req.user.userId)
  res.json({ success: true, user })
})

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError('Unauthorized', 401)
  const user = await userService.updateProfile(req.user.userId, req.body)
  res.json({ success: true, user })
})

export const addAddress = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError('Unauthorized', 401)
  const address = await userService.addAddress(req.user.userId, req.body)
  res.status(201).json({ success: true, address })
})

export const deleteAddress = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError('Unauthorized', 401)
  await userService.deleteAddress(req.user.userId, req.params.id as string)
  res.json({ success: true, message: 'Address deleted' })
})