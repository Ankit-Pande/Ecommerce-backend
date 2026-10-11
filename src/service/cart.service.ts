import { Prisma } from "@prisma/client";
import { prisma, lockUser } from "../config/db";
import { AppError } from "../utils/appError";
import { ACTIVE_CATEGORY, CARD_SELECT, productCard } from "../utils/price";

const MAX_QUANTITY = 10;
const MAX_ITEMS = 50;

export type Options = { size?: string; color?: string };

// Customer ka chuna size/rang product ke options me hona chahiye; ek hi rang ho to wahi; option na ho to "".
export function chooseOptions(product: { sizes: string[]; colors: string[] }, picked: Options) {
  const size = picked.size?.trim() ?? "";
  const color = picked.color?.trim() ?? (product.colors.length === 1 ? product.colors[0] : "");
  if (product.sizes.length > 0 ? !product.sizes.includes(size) : size !== "") {
    throw new AppError(product.sizes.length > 0 ? "Please choose a size" : "This product has no sizes", 400);
  }
  if (product.colors.length > 0 ? !product.colors.includes(color) : color !== "") {
    throw new AppError(product.colors.length > 0 ? "Please choose a colour" : "This product has no colours", 400);
  }
  return { size, color };
}

// Cart live price se banao; band ya out-of-stock item dikhe par total me na jude.
async function getCart(userId: string) {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    select: {
      items: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          quantity: true,
          size: true,
          color: true,
          product: {
            select: {
              ...CARD_SELECT,
              isActive: true,
              category: { select: { isActive: true, parent: { select: { isActive: true } } } },
            },
          },
        },
      },
    },
  });

  let totalPaise = 0;
  const items = (cart?.items ?? []).map(({ id, quantity, size, color, product }) => {
    const isAvailable = product.isActive && product.category.isActive && product.category.parent?.isActive !== false;
    const maxQuantity = Math.min(MAX_QUANTITY, product.stock);
    const card = productCard(product);
    if (isAvailable && quantity <= maxQuantity) totalPaise += card.finalPricePaise * quantity;

    return { id, quantity, size, color, product: { ...card, images: product.images, maxQuantity, isAvailable } };
  });

  return { items, totalPaise };
}

// Product chalu hai aur cart me iske saare size/rang mila kar itna stock hai? Nahi to error.
async function checkStock(db: Prisma.TransactionClient, cartId: string, productId: string, quantity: number, skipItemId?: string) {
  const product = await db.product.findFirst({
    where: { id: productId, isActive: true, category: ACTIVE_CATEGORY },
    select: { stock: true },
  });
  if (!product) throw new AppError("Product unavailable", 404);
  const others = await db.cartItem.aggregate({
    where: { cartId, productId, ...(skipItemId && { id: { not: skipItemId } }) },
    _sum: { quantity: true },
  });
  if (quantity > MAX_QUANTITY || quantity + (others._sum.quantity ?? 0) > product.stock) {
    throw new AppError("Quantity exceeds stock or maximum 10 units", 409);
  }
}

export const cartService = {
  getCart,

  // Cart me daalo (chune size/rang ke saath); wahi line pehle se hai to quantity jud jaati hai.
  async addItem(userId: string, productId: string, quantity: number, picked: Options = {}) {
    await prisma.$transaction(async (db) => {
      await lockUser(db, userId);
      const product = await db.product.findUnique({ where: { id: productId }, select: { sizes: true, colors: true } });
      if (!product) throw new AppError("Product unavailable", 404);
      const options = chooseOptions(product, picked);

      const cart = await db.cart.upsert({ where: { userId }, create: { userId }, update: {} });
      const line = { cartId_productId_size_color: { cartId: cart.id, productId, ...options } };
      const alreadyInCart = await db.cartItem.findUnique({ where: line });
      if (!alreadyInCart && (await db.cartItem.count({ where: { cartId: cart.id } })) >= MAX_ITEMS) {
        throw new AppError(`Cart can hold ${MAX_ITEMS} different items. Remove one first.`, 400);
      }
      const newQuantity = (alreadyInCart?.quantity ?? 0) + quantity;
      await checkStock(db, cart.id, productId, newQuantity, alreadyInCart?.id);

      await db.cartItem.upsert({
        where: line,
        create: { cartId: cart.id, productId, quantity, ...options },
        update: { quantity: newQuantity },
      });
    });
    return getCart(userId);
  },

  // Ek line ki quantity badlo (+/- button).
  async updateItem(userId: string, itemId: string, quantity: number) {
    await prisma.$transaction(async (db) => {
      await lockUser(db, userId);
      const item = await db.cartItem.findFirst({ where: { id: itemId, cart: { userId } } });
      if (!item) throw new AppError("Item not in cart", 404);
      await checkStock(db, item.cartId, item.productId, quantity, item.id);
      await db.cartItem.update({ where: { id: item.id }, data: { quantity } });
    });
    return getCart(userId);
  },

  // Poora cart khali karo.
  async clear(userId: string) {
    await prisma.$transaction(async (db) => {
      await lockUser(db, userId);
      await db.cartItem.deleteMany({ where: { cart: { userId } } });
    });
  },

  // Ek line cart se hatao.
  async removeItem(userId: string, itemId: string) {
    await prisma.$transaction(async (db) => {
      await lockUser(db, userId);
      await db.cartItem.deleteMany({ where: { id: itemId, cart: { userId } } });
    });
    return getCart(userId);
  },
};
