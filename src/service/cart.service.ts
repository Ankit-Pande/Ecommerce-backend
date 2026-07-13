import { prisma } from "../config/db";
import { AppError } from "../utils/appError";

// Cart hamesha live product price/stock ke saath bheja jaata hai (cart me purana
// price store nahi — checkout pe order me snapshot lega).
export const cartService = {
  // User ka cart laao (na ho to bana do). Items + live product info ek saath.
  async getCart(userId: string) {
    const cart = await prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
      select: {
        id: true,
        items: {
          select: {
            quantity: true,
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                description: true, // checkout summary short description ke liye
                color: true, // checkout me color chip dikhta hai
                categoryId: true, // cart/checkout "You may also like" suggestions ke liye
                pricePaise: true,
                discountPercent: true,
                images: true,
                stock: true,
                isActive: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    // Inactive/deleted products cart se hata ke dikhao (ganda data na dikhe).
    const items = cart.items.filter((i) => i.product.isActive);
    const totalPaise = items.reduce((sum, i) => {
      const price = i.product.pricePaise;
      const discounted = price - Math.round((price * i.product.discountPercent) / 100);
      return sum + discounted * i.quantity;
    }, 0);

    return { items, totalPaise };
  },

  // Add — pehle se ho to quantity badhao (duplicate row nahi, @@unique se safe).
  async addItem(userId: string, productId: string, quantity: number) {
    const product = await prisma.product.findFirst({
      where: { id: productId, isActive: true },
      select: { stock: true },
    });
    if (!product) throw new AppError("Product not found", 404);
    if (product.stock < quantity) throw new AppError("Not enough stock", 400);

    const cart = await prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
      select: { id: true },
    });

    await prisma.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId } },
      create: { cartId: cart.id, productId, quantity },
      update: { quantity: { increment: quantity } },
    });

    return this.getCart(userId);
  },

  // Quantity set karo (badhao/ghatao). Stock check.
  async updateItem(userId: string, productId: string, quantity: number) {
    const product = await prisma.product.findFirst({
      where: { id: productId, isActive: true },
      select: { stock: true },
    });
    if (!product) throw new AppError("Product not found", 404);
    if (product.stock < quantity) throw new AppError("Not enough stock", 400);

    const cart = await prisma.cart.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!cart) throw new AppError("Cart not found", 404);

    await prisma.cartItem.update({
      where: { cartId_productId: { cartId: cart.id, productId } },
      data: { quantity },
    });

    return this.getCart(userId);
  },

  async removeItem(userId: string, productId: string) {
    const cart = await prisma.cart.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!cart) throw new AppError("Cart not found", 404);

    await prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId } });
    return this.getCart(userId);
  },
};
