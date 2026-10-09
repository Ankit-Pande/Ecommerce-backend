import { CancelledBy, Order, OrderStatus, PaymentMethod, Prisma } from "@prisma/client";
import { prisma, lockUser } from "../config/db";
import { env } from "../config/env";
import { createRazorpayOrder } from "../integration/razorpay";
import { AppError } from "../utils/appError";
import { clearStoreCache } from "../config/cache";
import { pageQuery, paginate } from "../utils/paginate";
import { ACTIVE_CATEGORY, finalPrice, stockStatus } from "../utils/price";

const ALLOWED_NEXT_STATUS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [],
  CONFIRMED: ["SHIPPED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

const MIN_ONLINE_PAISE = 100;
const MAX_OPEN_COD_ORDERS = 10;
const MAX_ORDER_PAISE = 2147483647;

const ORDER_FIELDS = {
  id: true,
  totalPaise: true,
  status: true,
  paymentStatus: true,
  paymentMethod: true,
  needsReview: true,
  paymentExpiresAt: true,
  cancelledBy: true,
  createdAt: true,
} satisfies Prisma.OrderSelect;

// Checkout ka jawab — frontend isse Razorpay popup kholta hai.
function checkoutResponse(order: Order) {
  return {
    orderId: order.id,
    status: order.status,
    paymentStatus: order.paymentStatus,
    amount: order.totalPaise,
    paymentMethod: order.paymentMethod,
    razorpayOrderId: order.razorpayOrderId,
    razorpayKeyId: order.paymentMethod === "ONLINE" ? (env.RAZORPAY_KEY_ID ?? null) : null,
  };
}

type BuyNow = { productId: string; quantity: number };

// Order me kya-kya jayega (cart ya Buy now ka product) aur total; lockProducts=true par products ek tay kram me rok lo taaki beech me price ya stock na badle.
async function getOrderLines(db: Prisma.TransactionClient, userId: string, lockProducts: boolean, buyNow?: BuyNow) {
  let items: { cartItemId: string | null; productId: string; quantity: number }[];
  if (buyNow) {
    items = [{ cartItemId: null, ...buyNow }];
  } else {
    const cart = await db.cart.findUnique({
      where: { userId },
      include: { items: { orderBy: { productId: "asc" } } },
    });
    items = (cart?.items ?? []).map((item) => ({
      cartItemId: item.id,
      productId: item.productId,
      quantity: item.quantity,
    }));
  }
  if (items.length === 0) throw new AppError("Cart is empty", 400);

  const productIds = items.map((item) => item.productId);

  if (lockProducts) {
    await db.$queryRaw`
      SELECT "id" FROM "Product" WHERE "id" IN (${Prisma.join(productIds)}) ORDER BY "id" FOR UPDATE`;
  }

  const products = await db.product.findMany({
    where: { id: { in: productIds }, isActive: true, category: ACTIVE_CATEGORY },
    select: {
      id: true,
      name: true,
      images: true,
      pricePaise: true,
      discountPercent: true,
      offerEndsAt: true,
      stock: true,
    },
  });
  const productById = new Map(products.map((product) => [product.id, product]));

  let totalPaise = 0;
  const lines = [];
  for (const item of items) {
    const product = productById.get(item.productId);
    if (!product || product.stock < item.quantity) {
      throw new AppError("Some products are unavailable or out of stock", 409);
    }

    const pricePaise = finalPrice(product.pricePaise, product.discountPercent, product.offerEndsAt);
    totalPaise += pricePaise * item.quantity;
    lines.push({
      cartItemId: item.cartItemId,
      stockBefore: product.stock,
      productId: product.id,
      productName: product.name,
      productImage: product.images[0] ?? null,
      pricePaise,
      quantity: item.quantity,
    });
  }

  if (totalPaise > MAX_ORDER_PAISE) throw new AppError("Order amount is too large", 400);
  return { lines, totalPaise };
}

// Ek user ke khule order ki limit (koi stock rok ke na baithe): unpaid online kam, COD zyada.
async function checkOpenOrderLimit(db: Prisma.TransactionClient, userId: string, paymentMethod: PaymentMethod) {
  const status = paymentMethod === "ONLINE" ? "PENDING" : "CONFIRMED";
  const limit = paymentMethod === "ONLINE" ? env.MAX_PENDING_ORDERS : MAX_OPEN_COD_ORDERS;
  const open = await db.order.count({ where: { userId, paymentMethod, status } });
  if (open >= limit) {
    throw new AppError("You have too many open orders. Complete or cancel one first.", 409);
  }
}

// Order ko rok kar padho, taaki payment, cancel aur time-out wala kaam ek saath na chalein.
async function lockOrder(db: Prisma.TransactionClient, orderId: string) {
  await db.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError("Order not found", 404);
  return order;
}

// Order cancel karo aur stock wapas jodo.
async function cancelAndReturnStock(db: Prisma.TransactionClient, orderId: string, cancelledBy: CancelledBy) {
  await db.order.update({ where: { id: orderId }, data: { status: "CANCELLED", cancelledBy } });
  const items = await db.orderItem.findMany({ where: { orderId }, orderBy: { productId: "asc" } });
  for (const item of items) {
    await db.product.update({
      where: { id: item.productId },
      data: { stock: { increment: item.quantity } },
    });
  }
}

// Isi checkout ka order pehle ban chuka hai to wahi lautao (address ya payment alag ho to error).
function returnSameOrder(order: Order, addressId: string, paymentMethod: PaymentMethod) {
  if (order.addressId !== addressId || order.paymentMethod !== paymentMethod) {
    throw new AppError("Idempotency key used for another checkout", 409);
  }
  return checkoutResponse(order);
}

export const orderService = {
  // Order banao: pehle sab check, phir Razorpay order, phir ek saath stock kaato (jitna bacha ho), order save karo aur cart se wo items hatao.
  async checkout(
    userId: string,
    addressId: string,
    paymentMethod: PaymentMethod,
    idempotencyKey: string,
    buyNow?: BuyNow,
  ) {
    const sameOrderKey = { userId_idempotencyKey: { userId, idempotencyKey } };
    const previous = await prisma.order.findUnique({ where: sameOrderKey });
    if (previous) return returnSameOrder(previous, addressId, paymentMethod);

    const firstCheck = await getOrderLines(prisma, userId, false, buyNow);

    await checkOpenOrderLimit(prisma, userId, paymentMethod);
    const address = await prisma.address.findFirst({
      where: { id: addressId, userId },
      select: { id: true },
    });
    if (!address) throw new AppError("Address not found", 404);

    let razorpayOrderId: string | null = null;
    if (paymentMethod === "ONLINE") {
      if (firstCheck.totalPaise < MIN_ONLINE_PAISE) {
        throw new AppError("Online payment needs a minimum order of Rs 1. Please use Cash on Delivery.", 400);
      }
      razorpayOrderId = await createRazorpayOrder(firstCheck.totalPaise, idempotencyKey.slice(0, 40));
    }

    const result = await prisma.$transaction(async (db) => {
      await lockUser(db, userId);
      const alreadyMade = await db.order.findUnique({ where: sameOrderKey });
      if (alreadyMade) return { order: alreadyMade, isNew: false, stockStatusChanged: false };

      await checkOpenOrderLimit(db, userId, paymentMethod);
      const shipTo = await db.address.findFirst({ where: { id: addressId, userId } });
      if (!shipTo) throw new AppError("Address not found", 404);

      const latest = await getOrderLines(db, userId, true, buyNow);
      if (latest.totalPaise !== firstCheck.totalPaise) {
        throw new AppError("Prices changed. Please review your cart and try again.", 409);
      }

      let stockStatusChanged = false;
      for (const line of latest.lines) {
        const updated = await db.product.updateMany({
          where: { id: line.productId, stock: { gte: line.quantity } },
          data: { stock: { decrement: line.quantity } },
        });
        if (updated.count === 0) throw new AppError("Some products went out of stock", 409);
        if (stockStatus(line.stockBefore) !== stockStatus(line.stockBefore - line.quantity)) {
          stockStatusChanged = true;
        }
      }

      const order = await db.order.create({
        data: {
          userId,
          idempotencyKey,
          addressId,
          paymentMethod,
          totalPaise: latest.totalPaise,
          status: paymentMethod === "COD" ? "CONFIRMED" : "PENDING",
          paymentExpiresAt:
            paymentMethod === "ONLINE" ? new Date(Date.now() + env.PAYMENT_WINDOW_MINUTES * 60 * 1000) : null,
          razorpayOrderId,
          shipName: shipTo.fullName,
          shipPhone: shipTo.phone,
          shipLine1: shipTo.line1,
          shipLine2: shipTo.line2,
          shipCity: shipTo.city,
          shipState: shipTo.state,
          shipPincode: shipTo.pincode,
          items: {
            create: latest.lines.map(({ cartItemId: _cartItemId, stockBefore: _stockBefore, ...line }) => line),
          },
        },
      });

      const orderedCartItems = latest.lines.flatMap((line) => (line.cartItemId ? [line.cartItemId] : []));
      if (orderedCartItems.length > 0) {
        await db.cartItem.deleteMany({ where: { id: { in: orderedCartItems } } });
      }
      return { order, isNew: true, stockStatusChanged };
    });

    if (!result.isNew) return returnSameOrder(result.order, addressId, paymentMethod);
    if (result.stockStatusChanged) await clearStoreCache();
    return checkoutResponse(result.order);
  },

  // Payment popup band ho gaya tha — usi order ke liye dobara pay.
  async retryPayment(userId: string, orderId: string) {
    const order = await prisma.order.findFirst({ where: { id: orderId, userId } });
    if (!order) throw new AppError("Order not found", 404);

    const payable =
      order.status === "PENDING" &&
      order.paymentStatus === "PENDING" &&
      !order.needsReview &&
      order.razorpayOrderId !== null &&
      order.paymentExpiresAt !== null &&
      order.paymentExpiresAt > new Date();
    if (!payable) throw new AppError("Order is not available for payment", 409);
    return checkoutResponse(order);
  },

  // Razorpay ne bataya payment ho gayi: paise aur time sahi to order CONFIRM; late ya galat amount par order cancel aur admin refund kare.
  async handlePaymentCaptured(
    eventId: string,
    payment: { id: string; order_id: string; amount: number; currency: string },
  ) {
    let stockReturned = false;

    await prisma.$transaction(async (db) => {
      const firstTime = await db.webhookEvent.createMany({ data: [{ id: eventId }], skipDuplicates: true });
      if (firstTime.count === 0) return;

      const found = await db.order.findUnique({
        where: { razorpayOrderId: payment.order_id },
        select: { id: true },
      });
      if (!found) throw new Error(`Order not found for Razorpay order ${payment.order_id}`);
      const order = await lockOrder(db, found.id);

      if (order.paymentStatus !== "PENDING") {
        if (order.razorpayPaymentId !== payment.id) {
          await db.order.update({ where: { id: order.id }, data: { needsReview: true } });
        }
        return;
      }

      const onTime =
        order.status === "PENDING" && order.paymentExpiresAt !== null && order.paymentExpiresAt > new Date();
      const correctAmount = payment.amount === order.totalPaise && payment.currency === "INR";
      if (onTime && correctAmount) {
        await db.order.update({
          where: { id: order.id },
          data: { status: "CONFIRMED", paymentStatus: "COMPLETED", razorpayPaymentId: payment.id },
        });
        return;
      }

      if (order.status === "PENDING") {
        await cancelAndReturnStock(db, order.id, "SYSTEM");
        stockReturned = true;
      }
      await db.order.update({
        where: { id: order.id },
        data: { paymentStatus: "COMPLETED", razorpayPaymentId: payment.id, needsReview: true },
      });
    });

    if (stockReturned) await clearStoreCache();
  },

  // Order cancel (user apna, admin koi bhi) — sirf ship se pehle aur bina payment wala.
  async cancel(orderId: string, userId?: string) {
    await prisma.$transaction(async (db) => {
      const order = await lockOrder(db, orderId);
      if (userId && order.userId !== userId) throw new AppError("Order not found", 404);

      if (order.status === "CANCELLED") throw new AppError("Order is already cancelled", 409);
      if (order.status === "SHIPPED" || order.status === "DELIVERED") {
        throw new AppError(`Order is already ${order.status.toLowerCase()} and cannot be cancelled`, 409);
      }
      if (order.paymentStatus !== "PENDING") {
        throw new AppError(
          "Paid order cannot be cancelled here — refund is not available yet. Please contact the store.",
          409,
        );
      }
      await cancelAndReturnStock(db, orderId, userId ? "USER" : "ADMIN");
    });
    await clearStoreCache();
  },

  // Admin order status badle (SHIPPED / DELIVERED / CANCELLED).
  async updateStatus(orderId: string, status: OrderStatus) {
    if (status === "CANCELLED") return orderService.cancel(orderId);

    await prisma.$transaction(async (db) => {
      const order = await lockOrder(db, orderId);
      if (order.status === status) return;
      if (!ALLOWED_NEXT_STATUS[order.status].includes(status)) {
        throw new AppError(`Cannot change order from ${order.status} to ${status}`, 400);
      }
      if (order.needsReview) throw new AppError("Resolve the payment review first", 409);

      await db.order.update({
        where: { id: orderId },
        data: {
          status,
          ...(status === "DELIVERED" && order.paymentMethod === "COD" && { paymentStatus: "COMPLETED" as const }),
        },
      });
    });
  },

  // Admin ne Razorpay se refund kar diya — review band.
  async markRefunded(orderId: string) {
    await prisma.$transaction(async (db) => {
      const order = await lockOrder(db, orderId);
      if (!order.needsReview) throw new AppError("Order does not need a refund", 409);

      await db.order.update({
        where: { id: orderId },
        data: {
          needsReview: false,
          ...(order.status === "CANCELLED" && { paymentStatus: "REFUNDED" as const }),
        },
      });
    });
  },

  // Time par pay na hue online order cancel + stock wapas (har minute).
  async releaseExpiredOrders() {
    const expired = await prisma.order.findMany({
      where: {
        paymentMethod: "ONLINE",
        status: "PENDING",
        paymentStatus: "PENDING",
        paymentExpiresAt: { lte: new Date() },
      },
      select: { id: true },
      take: 100,
    });

    for (const { id } of expired) {
      await prisma.$transaction(async (db) => {
        const order = await lockOrder(db, id);
        if (order.status !== "PENDING" || order.paymentStatus !== "PENDING") return;
        await cancelAndReturnStock(db, id, "SYSTEM");
      });
    }
    if (expired.length > 0) await clearStoreCache();
  },

  // User ke orders, naye pehle.
  async listForUser(userId: string, status: OrderStatus[] | undefined, cursor: string | undefined, limit: number) {
    const orders = await prisma.order.findMany({
      where: { userId, ...(status && { status: { in: status } }) },
      select: {
        ...ORDER_FIELDS,
        items: { select: { productName: true, productImage: true, pricePaise: true, quantity: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...pageQuery(cursor, limit),
    });
    return paginate(orders, limit);
  },

  // User ka ek order: items (photo, description aur product link ke saath), delivery address aur payment.
  async getForUser(userId: string, orderId: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId },
      select: {
        ...ORDER_FIELDS,
        updatedAt: true,
        shipName: true,
        shipPhone: true,
        shipLine1: true,
        shipLine2: true,
        shipCity: true,
        shipState: true,
        shipPincode: true,
        items: {
          select: {
            productId: true,
            productName: true,
            productImage: true,
            pricePaise: true,
            quantity: true,
            product: { select: { slug: true, description: true } },
          },
        },
      },
    });
    if (!order) throw new AppError("Order not found", 404);
    return order;
  },
};
