import { Order, OrderStatus, PaymentMethod, Prisma } from "@prisma/client";
import { prisma, lockUser } from "../config/db";
import { env } from "../config/env";
import { createRazorpayOrder, verifyPaymentSignature } from "../integration/razorpay";
import { AppError } from "../utils/appError";
import { bumpStorefrontCache } from "../config/cache";
import { paginate } from "../utils/paginate";
import { ACTIVE_CATEGORY, finalPrice, stockStatus } from "../utils/price";

// Admin order ko sirf aage badha sakta hai (CONFIRMED -> SHIPPED -> DELIVERED).
const NEXT_STATUS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [],
  CONFIRMED: ["SHIPPED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

// Razorpay ₹1 se kam ka order nahi banata.
const MIN_ONLINE_PAISE = 100;

const ORDER_FIELDS = {
  id: true,
  totalPaise: true,
  status: true,
  paymentStatus: true,
  paymentMethod: true,
  needsReview: true,
  paymentExpiresAt: true,
  createdAt: true,
} satisfies Prisma.OrderSelect;

// Checkout ka jawab — frontend isse Razorpay popup kholta hai.
function checkoutResponse(order: Order) {
  const joiner = env.CHECKOUT_URL.includes("?") ? "&" : "?";
  return {
    orderId: order.id,
    status: order.status,
    paymentStatus: order.paymentStatus,
    amount: order.totalPaise,
    paymentMethod: order.paymentMethod,
    razorpayOrderId: order.razorpayOrderId,
    razorpayKeyId: order.paymentMethod === "ONLINE" ? (env.RAZORPAY_KEY_ID ?? null) : null,
    checkoutUrl: `${env.CHECKOUT_URL}${joiner}orderId=${encodeURIComponent(order.id)}`,
  };
}

type BuyNow = { productId: string; quantity: number };

// Order ki lines: cart ke items, ya "Buy now" me sirf ek product (cart ko chhue bina).
// lock=true par products lock, taaki beech me price/stock na badle.
async function readLines(db: Prisma.TransactionClient, userId: string, lock: boolean, buyNow?: BuyNow) {
  const items = buyNow
    ? [{ cartItemId: null, ...buyNow }]
    : ((
        await db.cart.findUnique({
          where: { userId },
          include: { items: { orderBy: { productId: "asc" } } },
        })
      )?.items.map((item) => ({ cartItemId: item.id, productId: item.productId, quantity: item.quantity })) ?? []);
  if (items.length === 0) throw new AppError("Cart is empty", 400);

  const productIds = items.map((item) => item.productId);

  // id ke kram me lock, taaki do checkout aapas me na atakein (deadlock).
  if (lock) {
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
  const byId = new Map(products.map((product) => [product.id, product]));

  let totalPaise = 0;
  const lines = [];
  for (const item of items) {
    const product = byId.get(item.productId);
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

  // DB column Int hai.
  if (totalPaise > 2147483647) throw new AppError("Order amount is too large", 400);
  return { lines, totalPaise };
}

// Ek user ke zyada khule order na hon (stock rok ke baithne wala spam).
async function checkOpenOrders(tx: Prisma.TransactionClient, userId: string, paymentMethod: PaymentMethod) {
  // Online: abhi pay nahi hua (PENDING). COD: abhi ship nahi hua (CONFIRMED).
  const status = paymentMethod === "ONLINE" ? "PENDING" : "CONFIRMED";
  const open = await tx.order.count({ where: { userId, paymentMethod, status } });
  if (open >= env.MAX_PENDING_ORDERS) {
    throw new AppError("You have too many open orders. Complete or cancel one first.", 409);
  }
}

// Order row lock — webhook, cancel aur expiry ek saath na chalein.
async function lockOrder(tx: Prisma.TransactionClient, orderId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
  const order = await tx.order.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError("Order not found", 404);
  return order;
}

// Order cancel karo aur stock wapas jodo.
async function cancelLockedOrder(tx: Prisma.TransactionClient, orderId: string) {
  await tx.order.update({ where: { id: orderId }, data: { status: "CANCELLED" } });
  const items = await tx.orderItem.findMany({ where: { orderId }, orderBy: { productId: "asc" } });
  for (const item of items) {
    await tx.product.update({
      where: { id: item.productId },
      data: { stock: { increment: item.quantity } },
    });
  }
}

// Same key ka order pehle se hai to wahi lautao (address/method alag ho to 409).
function sameCheckout(order: Order, addressId: string, paymentMethod: PaymentMethod) {
  if (order.addressId !== addressId || order.paymentMethod !== paymentMethod) {
    throw new AppError("Idempotency key used for another checkout", 409);
  }
  return checkoutResponse(order);
}

export const orderService = {
  // Cart (ya Buy now ka ek product) se order: checks -> Razorpay order -> transaction me stock kaato + order save.
  async checkout(
    userId: string,
    addressId: string,
    paymentMethod: PaymentMethod,
    idempotencyKey: string,
    buyNow?: BuyNow,
  ) {
    const sameKey = { userId_idempotencyKey: { userId, idempotencyKey } };
    const previous = await prisma.order.findUnique({ where: sameKey });
    if (previous) return sameCheckout(previous, addressId, paymentMethod);

    const preview = await readLines(prisma, userId, false, buyNow);

    // Pehle check, taaki galat request par bekaar Razorpay order na bane.
    await checkOpenOrders(prisma, userId, paymentMethod);
    const address = await prisma.address.findFirst({
      where: { id: addressId, userId },
      select: { id: true },
    });
    if (!address) throw new AppError("Address not found", 404);

    let razorpayOrderId: string | null = null;
    if (paymentMethod === "ONLINE") {
      if (preview.totalPaise < MIN_ONLINE_PAISE) {
        throw new AppError("Online payment needs a minimum order of Rs 1. Please use Cash on Delivery.", 400);
      }
      razorpayOrderId = await createRazorpayOrder(preview.totalPaise, idempotencyKey.slice(0, 40));
    }

    const result = await prisma.$transaction(async (tx) => {
      await lockUser(tx, userId);
      const raced = await tx.order.findUnique({ where: sameKey });
      if (raced) return { order: raced, isNew: false, stockStatusChanged: false };

      await checkOpenOrders(tx, userId, paymentMethod);
      const shipTo = await tx.address.findFirst({ where: { id: addressId, userId } });
      if (!shipTo) throw new AppError("Address not found", 404);

      const cart = await readLines(tx, userId, true, buyNow);
      // Razorpay order jitne ka bana, order bhi utne ka hi ho.
      if (cart.totalPaise !== preview.totalPaise) {
        throw new AppError("Prices changed. Please review your cart and try again.", 409);
      }

      // Stock sirf tab kaato jab bacha ho (race condition yahin rukti hai).
      let stockStatusChanged = false;
      for (const line of cart.lines) {
        const updated = await tx.product.updateMany({
          where: { id: line.productId, stock: { gte: line.quantity } },
          data: { stock: { decrement: line.quantity } },
        });
        if (updated.count === 0) throw new AppError("Some products went out of stock", 409);
        if (stockStatus(line.stockBefore) !== stockStatus(line.stockBefore - line.quantity)) {
          stockStatusChanged = true;
        }
      }

      const order = await tx.order.create({
        data: {
          userId,
          idempotencyKey,
          addressId,
          paymentMethod,
          totalPaise: cart.totalPaise,
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
            create: cart.lines.map(({ cartItemId: _cartItemId, stockBefore: _stockBefore, ...line }) => line),
          },
        },
      });

      // Sirf wahi cart items hatao jo order me gaye (Buy now me koi nahi).
      const orderedCartItems = cart.lines.flatMap((line) => (line.cartItemId ? [line.cartItemId] : []));
      if (orderedCartItems.length > 0) {
        await tx.cartItem.deleteMany({ where: { id: { in: orderedCartItems } } });
      }
      return { order, isNew: true, stockStatusChanged };
    });

    if (!result.isNew) return sameCheckout(result.order, addressId, paymentMethod);
    if (result.stockStatusChanged) await bumpStorefrontCache();
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

  // Browser ka signature check (order confirm sirf webhook se hota hai).
  async verifyPayment(userId: string, razorpayOrderId: string, razorpayPaymentId: string, signature: string) {
    const order = await prisma.order.findFirst({ where: { razorpayOrderId, userId } });
    if (!order) throw new AppError("Order not found", 404);
    if (!verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, signature)) {
      throw new AppError("Payment verification failed", 400);
    }
    return {
      status: order.status,
      paymentStatus: order.paymentStatus,
      message: "Payment submitted. Waiting for payment confirmation.",
    };
  },

  // Payment aa gayi (webhook): amount aur time sahi to order CONFIRM, warna review.
  async handlePaymentCaptured(
    eventId: string,
    payment: { id: string; order_id: string; amount: number; currency: string },
  ) {
    let stockReturned = false;

    await prisma.$transaction(async (tx) => {
      // Ye event pehle aa chuka hai to kuch mat karo.
      const saved = await tx.webhookEvent.createMany({ data: [{ id: eventId }], skipDuplicates: true });
      if (saved.count === 0) return;

      const found = await tx.order.findUnique({
        where: { razorpayOrderId: payment.order_id },
        select: { id: true },
      });
      // Order abhi nahi mila — error do, Razorpay thodi der baad dobara bhejega.
      if (!found) throw new Error(`Order not found for Razorpay order ${payment.order_id}`);
      const order = await lockOrder(tx, found.id);

      if (order.paymentStatus !== "PENDING") {
        // Ek order par doosri payment aa gayi — admin refund kare.
        if (order.razorpayPaymentId !== payment.id) {
          await tx.order.update({ where: { id: order.id }, data: { needsReview: true } });
        }
        return;
      }

      const onTime =
        order.status === "PENDING" && order.paymentExpiresAt !== null && order.paymentExpiresAt > new Date();
      const rightAmount = payment.amount === order.totalPaise && payment.currency === "INR";
      if (onTime && rightAmount) {
        await tx.order.update({
          where: { id: order.id },
          data: { status: "CONFIRMED", paymentStatus: "COMPLETED", razorpayPaymentId: payment.id },
        });
        return;
      }

      // Deadline ke baad ya galat amount: order cancel (stock wapas), paisa admin lautayega.
      if (order.status === "PENDING") {
        await cancelLockedOrder(tx, order.id);
        stockReturned = true;
      }
      await tx.order.update({
        where: { id: order.id },
        data: { paymentStatus: "COMPLETED", razorpayPaymentId: payment.id, needsReview: true },
      });
    });

    if (stockReturned) await bumpStorefrontCache();
  },

  // Order cancel (user apna, admin koi bhi) — sirf ship se pehle aur bina payment wala.
  async cancel(orderId: string, userId?: string) {
    await prisma.$transaction(async (tx) => {
      const order = await lockOrder(tx, orderId);
      // Doosre ka order "not found" jaisa dikhe.
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
      await cancelLockedOrder(tx, orderId);
    });
    await bumpStorefrontCache();
  },

  // Admin order status badle (SHIPPED / DELIVERED / CANCELLED).
  async updateStatus(orderId: string, status: OrderStatus) {
    if (status === "CANCELLED") return orderService.cancel(orderId);

    await prisma.$transaction(async (tx) => {
      const order = await lockOrder(tx, orderId);
      if (order.status === status) return;
      if (!NEXT_STATUS[order.status].includes(status)) {
        throw new AppError(`Cannot change order from ${order.status} to ${status}`, 400);
      }
      if (order.needsReview) throw new AppError("Resolve the payment review first", 409);

      await tx.order.update({
        where: { id: orderId },
        data: {
          status,
          // COD deliver = paisa mil gaya.
          ...(status === "DELIVERED" &&
            order.paymentMethod === "COD" && { paymentStatus: "COMPLETED" as const }),
        },
      });
    });
  },

  // Admin ne Razorpay se refund kar diya — review band.
  async markRefunded(orderId: string) {
    await prisma.$transaction(async (tx) => {
      const order = await lockOrder(tx, orderId);
      if (!order.needsReview) throw new AppError("Order does not need a refund", 409);

      await tx.order.update({
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
      await prisma.$transaction(async (tx) => {
        const order = await lockOrder(tx, id);
        // Lock milne tak webhook ne pay kar diya ho sakta hai.
        if (order.status !== "PENDING" || order.paymentStatus !== "PENDING") return;
        await cancelLockedOrder(tx, id);
      });
    }
    if (expired.length > 0) await bumpStorefrontCache();
  },

  // User ke orders, naye pehle.
  async listForUser(
    userId: string,
    status: OrderStatus[] | undefined,
    cursor: string | undefined,
    limit: number,
  ) {
    const orders = await prisma.order.findMany({
      where: { userId, ...(status && { status: { in: status } }) },
      select: {
        ...ORDER_FIELDS,
        items: { select: { productName: true, productImage: true, pricePaise: true, quantity: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });
    return paginate(orders, limit);
  },

  // User ka ek order, address aur items ke saath.
  async getForUser(userId: string, orderId: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId },
      select: {
        ...ORDER_FIELDS,
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
          },
        },
      },
    });
    if (!order) throw new AppError("Order not found", 404);
    return order;
  },
};
