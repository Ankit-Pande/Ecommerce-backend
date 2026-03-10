import { prisma } from '../config/db'
import { AppError } from '../utils/AppError'
import { cartService } from './CartService'
import { OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client'
import { paymentService } from './PaymentService'

export const orderService = {
  async createOrder(
    userId: string,
    addressId: string,
    paymentMethod: PaymentMethod
  ) {
    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: { items: { include: { product: true } } },
    })

    if (!cart || cart.items.length === 0) {
      throw new AppError('Your cart is empty', 400)
    }

    const address = await prisma.address.findFirst({
      where: { id: addressId, userId },
    })

    if (!address) throw new AppError('Delivery address not found', 404)

    const shippingAddress = `${address.receiverName}, ${address.line1}, ${address.city}, ${address.state} - ${address.zip}, Phone: ${address.receiverPhone}`

    const order = await prisma.$transaction(async (tx) => {
      let totalAmount = 0
      let totalDiscount = 0

      for (const item of cart.items) {
        const originalPrice = Number(item.product.price)
        const effectivePrice = Number(item.product.discountPrice ?? item.product.price)

        totalAmount += originalPrice * item.quantity
        totalDiscount += (originalPrice - effectivePrice) * item.quantity

        const updatedProduct = await tx.product.updateMany({
          where: {
            id: item.productId,
            stock: { gte: item.quantity },
            isHidden: false,
          },
          data: {
            stock: { decrement: item.quantity },
          },
        })

        if (updatedProduct.count === 0) {
          throw new AppError(`Product '${item.product.name}' is out of stock or hidden`, 400)
        }
      }

      const finalAmount = totalAmount - totalDiscount

      const newOrder = await tx.order.create({
        data: {
          userId,
          shippingAddress,
          totalAmount,
          totalDiscount,
          finalAmount,
          paymentMethod,
          paymentStatus:
            paymentMethod === PaymentMethod.COD
              ? PaymentStatus.PENDING
              : PaymentStatus.PENDING,
          orderStatus: OrderStatus.PENDING,
          items: {
            create: cart.items.map((item) => ({
              productId: item.productId,
              name: item.product.name,
              price: Number(item.product.discountPrice ?? item.product.price),
              quantity: item.quantity,
            })),
          },
        },
        include: { items: true },
      })

      if (paymentMethod === PaymentMethod.ONLINE) {
        const razOrder = await paymentService.createRazorpayOrder(finalAmount, newOrder.id)

        const updatedOrder = await tx.order.update({
          where: { id: newOrder.id },
          data: {
            razorpayOrderId: razOrder.id,
          },
          include: { items: true },
        })

        return {
          ...updatedOrder,
          razorpay: {
            orderId: razOrder.id,
            amount: razOrder.amount,
            currency: razOrder.currency,
            keyId: process.env.RAZORPAY_KEY_ID,
          },
        }
      }

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } })

      return newOrder
    })

    if (paymentMethod === PaymentMethod.COD) {
      await cartService.clearCartCache(userId)
    }

    return order
  },

  async getUserOrders(userId: string) {
    return prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            product: {
              select: { imageUrl: true, images: true, slug: true },
            },
          },
        },
      },
    })
  },

  async getOrderById(userId: string, orderId: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        items: {
          include: {
            product: {
              select: { imageUrl: true, images: true, slug: true },
            },
          },
        },
      },
    })

    if (!order) throw new AppError('Order not found', 404)
    return order
  },

  async updateOrderStatus(orderId: string, status: OrderStatus) {
    return prisma.order.update({
      where: { id: orderId },
      data: { orderStatus: status },
    })
  },
}