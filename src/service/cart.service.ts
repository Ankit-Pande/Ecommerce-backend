import { Prisma } from "@prisma/client";
import { prisma, lockUser } from "../config/db";
import { AppError } from "../utils/appError";
import { ACTIVE_CATEGORY, CARD_SELECT, productCard } from "../utils/price";

const MAX_QTY = 10;
const MAX_ITEMS = 50;

// Cart live price se banao; band ya out-of-stock item dikhe par total me na jude.
async function getCart(userId: string) {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    select: {
      items: {
        orderBy: { createdAt: "desc" },
        select: {
          quantity: true,
          product: {
            select: {
              ...CARD_SELECT,
              color: true,
              isActive: true,
              category: { select: { isActive: true, parent: { select: { isActive: true } } } },
            },
          },
        },
      },
    },
  });

  let totalPaise = 0;
  const items = (cart?.items ?? []).map(({ quantity, product }) => {
    const isAvailable =
      product.isActive && product.category.isActive && product.category.parent?.isActive !== false;
    const maxQuantity = Math.min(MAX_QTY, product.stock);
    const card = productCard(product);
    if (isAvailable && quantity <= maxQuantity) totalPaise += card.finalPricePaise * quantity;

    return {
      quantity,
      product: { ...card, color: product.color, images: product.images, maxQuantity, isAvailable },
    };
  });

  return { items, totalPaise };
}

// Product chalu hai aur itna stock hai? Nahi to error.
async function checkStock(tx: Prisma.TransactionClient, productId: string, quantity: number) {
  const product = await tx.product.findFirst({
    where: { id: productId, isActive: true, category: ACTIVE_CATEGORY },
    select: { stock: true },
  });
  if (!product) throw new AppError("Product unavailable", 404);
  if (quantity > MAX_QTY || quantity > product.stock) {
    throw new AppError("Quantity exceeds stock or maximum 10 units", 409);
  }
}

export const cartService = {
  getCart,

  // Cart me daalo; pehle se hai to quantity jud jaati hai (duplicate nahi).
  async addItem(userId: string, productId: string, quantity: number) {
    await prisma.$transaction(async (tx) => {
      await lockUser(tx, userId);
      const cart = await tx.cart.upsert({ where: { userId }, create: { userId }, update: {} });
      const existing = await tx.cartItem.findUnique({
        where: { cartId_productId: { cartId: cart.id, productId } },
      });
      if (!existing) {
        const items = await tx.cartItem.count({ where: { cartId: cart.id } });
        if (items >= MAX_ITEMS) {
          throw new AppError(`Cart can hold ${MAX_ITEMS} different products. Remove one first.`, 400);
        }
      }
      const total = (existing?.quantity ?? 0) + quantity;
      await checkStock(tx, productId, total);

      await tx.cartItem.upsert({
        where: { cartId_productId: { cartId: cart.id, productId } },
        create: { cartId: cart.id, productId, quantity },
        update: { quantity: total },
      });
    });
    return getCart(userId);
  },

  // Quantity badlo (+/- button).
  async updateItem(userId: string, productId: string, quantity: number) {
    await prisma.$transaction(async (tx) => {
      await lockUser(tx, userId);
      await checkStock(tx, productId, quantity);
      const changed = await tx.cartItem.updateMany({
        where: { productId, cart: { userId } },
        data: { quantity },
      });
      if (changed.count === 0) throw new AppError("Item not in cart", 404);
    });
    return getCart(userId);
  },

  // Ek item cart se hatao.
  async removeItem(userId: string, productId: string) {
    await prisma.$transaction(async (tx) => {
      await lockUser(tx, userId);
      await tx.cartItem.deleteMany({ where: { productId, cart: { userId } } });
    });
    return getCart(userId);
  },

  // Poora cart khaali karo.
  async clearCart(userId: string) {
    await prisma.$transaction(async (tx) => {
      await lockUser(tx, userId);
      await tx.cartItem.deleteMany({ where: { cart: { userId } } });
    });
    return { items: [], totalPaise: 0 };
  },
};
