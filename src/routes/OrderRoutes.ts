import express, { Router } from 'express'
import { Role } from '@prisma/client'
import { authCheck } from '../middlewares/Authcheck'
import { roleCheck } from '../middlewares/Rolecheck'
import { blockCheck } from '../middlewares/Blockcheck'
import { validate } from '../middlewares/Validation'
import { createOrderSchema, updateOrderStatusSchema } from '../validation/Order'
import {
  createOrder,
  getMyOrders,
  getOrderDetails,
  updateOrderStatus,
} from '../controllers/OrderControll'
import { handleRazorpayWebhook } from '../controllers/PaymentControll'

const router = Router()

router.post(
  '/razorpay-webhook',
  express.raw({ type: 'application/json' }),
  handleRazorpayWebhook
)

router.use(authCheck)
router.use(blockCheck)

router.post('/', validate(createOrderSchema), createOrder)
router.get('/', getMyOrders)
router.get('/:id', getOrderDetails)

router.patch(
  '/:id/status',
  roleCheck(Role.ADMIN),
  validate(updateOrderStatusSchema),
  updateOrderStatus
)

export const orderRoutes = router