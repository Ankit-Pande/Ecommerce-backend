import { prisma } from '../config/db'
import { redis } from '../config/redis'
import { AppError } from '../utils/AppError'
import { logger } from '../config/winston'

const getCacheKey = (userId: string): string => {
  return `cart:${userId}`
}

export const cartService = {
  async getCart(userId: string) {
    const cacheKey = getCacheKey(userId)

    try {
      const cached = await redis.get(cacheKey)
      if (cached) return JSON.parse(cached)
    } catch (e) {
      logger.error('Redis Cart Get Error', { e })
    }

    let cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, slug: true, price: true, discountPrice: true, imageUrl: true, images: true, stock: true }
            }
          }
        }
      }
    })

    if (!cart) {
      cart = await prisma.cart.create({ 
        data: { userId }, 
        include: { items: { include: { product: true } } } 
      })
    }

    let totalPrice = 0
    let totalDiscountPrice = 0

    const formattedItems = cart.items.map(item => {
    const effectivePrice = Number(item.product.discountPrice ?? item.product.price)
      
    totalPrice += Number(item.product.price) * item.quantity
    totalDiscountPrice += effectivePrice * item.quantity

      return {
        cartItemId: item.id,
        productId: item.productId,
        name: item.product.name,
        slug: item.product.slug,
        price: item.product.price,
        discountPrice: item.product.discountPrice,
        imageUrl: item.product.images?.length > 0 ? item.product.images[0] : item.product.imageUrl,
        quantity: item.quantity,
        inStock: item.product.stock >= item.quantity,
        totalItemPrice: Number(effectivePrice) * item.quantity
      }
    })

    const cartData = {
      cartId: cart.id,
      items: formattedItems,
      totalPrice,
      totalDiscountPrice,
      totalSavings: totalPrice - totalDiscountPrice
    }

    try {
      await redis.set(cacheKey, JSON.stringify(cartData), 'EX', 3600)
    } catch (e) { }

    return cartData
  },
  async addItem(userId: string, productId: string, quantity: number) {
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new AppError('Quantity must be at least 1', 400)
    }
    await prisma.$transaction(async (tx) => {
      const cart = await tx.cart.upsert({
        where: { userId },
        update: {},
        create: { userId },
      })

      const product = await tx.product.findFirst({
        where: { id: productId, isHidden: false },
        select: { id: true, stock: true },
      })
      
      if (!product) throw new AppError('Product not found or inactive', 404)

      const existingItem = await tx.cartItem.findUnique({
        where: { cartId_productId: { cartId: cart.id, productId } },
        select: { id: true, quantity: true },
      })

      const existingQty = existingItem?.quantity ?? 0
      const totalQuantity = existingQty + quantity

      if (product.stock < totalQuantity) {
        throw new AppError(
          `Only ${product.stock} items left in stock. You already have ${existingQty} in cart.`, 
          400
        )
      }

      await tx.cartItem.upsert({
        where: { cartId_productId: { cartId: cart.id, productId } },
        update: { quantity: totalQuantity },
        create: { cartId: cart.id, productId, quantity },
      })
    })

    await this.clearCartCache(userId)
    return this.getCart(userId)
  },
  async updateItemQuantity(userId: string, cartItemId: string, quantity: number) {
    const cart = await prisma.cart.findUnique({ where: { userId } })
    if (!cart) throw new AppError('Cart not found', 404)

    const item = await prisma.cartItem.findFirst({ 
      where: { id: cartItemId, cartId: cart.id }, 
      include: { product: true } 
    })
    
    if (!item) throw new AppError('Item not found in your cart', 404)
    
    if (item.product.stock < quantity) {
      throw new AppError(`Only ${item.product.stock} items left in stock`, 400)
    }

    await prisma.cartItem.update({ 
      where: { id: cartItemId }, 
      data: { quantity } 
    })

    await this.clearCartCache(userId)
    return this.getCart(userId)
  },
  async removeItem(userId: string, cartItemId: string) {
    const cart = await prisma.cart.findUnique({ where: { userId } })
    if (!cart) throw new AppError('Cart not found', 404)

    await prisma.cartItem.deleteMany({ 
      where: { id: cartItemId, cartId: cart.id } 
    })

    await this.clearCartCache(userId)
    return this.getCart(userId)
  },
  async clearCartCache(userId: string) {
    try {
      await redis.del(getCacheKey(userId))
    } catch (e) { }
  }
}