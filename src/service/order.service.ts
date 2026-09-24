import { Order, OrderStatus, PaymentMethod, Prisma } from "@prisma/client";
import { prisma, lockUser } from "../config/db";
import { env } from "../config/env";
import { createRazorpayOrder, verifyPaymentSignature } from "../integration/razorpay";
import { AppError } from "../utils/appError";
import { bumpStorefrontCache } from "../config/cache";
import { paginate } from "../utils/paginate";
import { ACTIVE_CATEGORY, finalPrice, stockStatus } from "../utils/price";

// Admin order ko sirf aage badha sakta hai. PENDING online order sirf webhook se
// CONFIRMED hota hai, COD bante hi CONFIRMED hota hai.
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

// Checkout ka jawab — frontend isi se Razorpay popup kholta hai.
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

// Cart ke items live price ke saath. lock=true (transaction ke andar) pe product rows
// lock hoti hain taaki beech me price/stock na badle — product id ke kram me, deadlock nahi.
async function readCart(db: Prisma.TransactionClient, userId: string, lock: boolean) {
  const cart = await db.cart.findUnique({
    where: { userId },
    include: { items: { orderBy: { productId: "asc" } } },
  });
  if (!cart || cart.items.length === 0) throw new AppError("Cart is empty", 400);

  const productIds = cart.items.map((item) => item.productId);

  // Saare products ek hi query me lock — id ke kram me, isliye do checkout aapas me nahi atakte.
  if (lock) {
    await db.$queryRaw`
      SELECT "id" FROM "Product" WHERE "id" IN (${Prisma.join(productIds)}) ORDER BY "id" FOR UPDATE`;
  }

  // Saare product ek hi query me — pehle har item ke liye alag query jaati thi, wo bhi lock pakde hue.
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
  for (const item of cart.items) {
    const product = byId.get(item.productId);
    if (!product || product.stock < item.quantity) {
      throw new AppError("Some products in your cart are unavailable or out of stock", 409);
    }

    const pricePaise = finalPrice(product.pricePaise, product.discountPercent, product.offerEndsAt);
    totalPaise += pricePaise * item.quantity;
    lines.push({
      cartItemId: item.id,
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

// Ek user ke itne hi "khule" order — stock rok ke baithne wala spam na ho.
async function checkOpenOrders(tx: Prisma.TransactionClient, userId: string, paymentMethod: PaymentMethod) {
  const open = await tx.order.count({
    where:
      paymentMethod === "ONLINE"
        ? { userId, paymentMethod, status: "PENDING" }
        : { userId, paymentMethod, status: "CONFIRMED" },
  });
  if (open >= env.MAX_PENDING_ORDERS) {
    throw new AppError("You have too many open orders. Complete or cancel one first.", 409);
  }
}

// Order row lock — payment webhook, cancel aur expiry ek saath na chalein.
async function lockOrder(tx: Prisma.TransactionClient, orderId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
  return tx.order.findUniqueOrThrow({ where: { id: orderId } });
}

// CANCELLED + stock wapas. Status CANCELLED ho chuka ho to dobara nahi bulate,
// isliye stock ek hi baar lautta hai.
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

// Same key ka order pehle se hai. Key kisi aur address/method ke liye use hui thi to mana.
function sameCheckout(order: Order, addressId: string, paymentMethod: PaymentMethod) {
  if (order.addressId !== addressId || order.paymentMethod !== paymentMethod) {
    throw new AppError("Idempotency key used for another checkout", 409);
  }
  return checkoutResponse(order);
}

export const orderService = {
  // Cart -> order. Flow:
  //  1. same idempotencyKey dobara aayi (double click/retry) -> wahi order
  //  2. address aur open-order limit check (Razorpay call se pehle)
  //  3. ONLINE: Razorpay order (bahar ki call transaction ke andar nahi)
  //  4. transaction: user lock, products lock, stock guard ke saath kam, order + items, cart items hatao
  // Step 4 fail ho to Razorpay order bina pay hue pada rehta hai — user ko wo mila hi nahi, nuksan nahi.
  async checkout(userId: string, addressId: string, paymentMethod: PaymentMethod, idempotencyKey: string) {
    const sameKey = { userId_idempotencyKey: { userId, idempotencyKey } };
    const previous = await prisma.order.findUnique({ where: sameKey });
    if (previous) return sameCheckout(previous, addressId, paymentMethod);

    const preview = await readCart(prisma, userId, false);

    // Ye dono check transaction ke andar bhi hote hain (asli faisla wahi hai), par yahan
    // pehle karne se galat request par bekaar ka Razorpay order nahi banta.
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

      const cart = await readCart(tx, userId, true);
      // Razorpay order jitne ka bana, order bhi utne ka hi ho.
      if (cart.totalPaise !== preview.totalPaise) {
        throw new AppError("Prices changed. Please review your cart and try again.", 409);
      }

      // Storefront sirf stockStatus dikhata hai, ginti nahi. Isliye cache tabhi naya karo jab
      // kisi product ka status badle — warna har order poore cache ko bekaar kar deta hai.
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
          // COD: turant CONFIRMED, paisa delivery pe.
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

      // Sirf wahi items hatao jo order me gaye.
      await tx.cartItem.deleteMany({ where: { id: { in: cart.lines.map((line) => line.cartItemId) } } });
      return { order, isNew: true, stockStatusChanged };
    });

    if (!result.isNew) return sameCheckout(result.order, addressId, paymentMethod);
    if (result.stockStatusChanged) await bumpStorefrontCache();
    return checkoutResponse(result.order);
  },

  // Popup band ho gaya tha — usi order ke liye dobara pay (deadline ke andar).
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

  // Browser ka signature sirf check hota hai. Order CONFIRMED sirf webhook se hota hai
  // (browser se aaya data bharose layak nahi).
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

  // Razorpay "payment.captured" webhook.
  async handlePaymentCaptured(
    eventId: string,
    payment: { id: string; order_id: string; amount: number; currency: string },
  ) {
    // Payment confirm hone par stock nahi badalta — wo checkout par hi kat chuka tha.
    // Cache sirf tab naya karo jab late/galat payment par order cancel karna pade.
    let stockReturned = false;

    await prisma.$transaction(async (tx) => {
      // Razorpay ek event dobara bhej sakta hai — pehle aa chuka to kuch mat karo.
      const saved = await tx.webhookEvent.createMany({ data: [{ id: eventId }], skipDuplicates: true });
      if (saved.count === 0) return;

      const found = await tx.order.findUnique({
        where: { razorpayOrderId: payment.order_id },
        select: { id: true },
      });
      // Checkout transaction shayad abhi commit nahi hua. Yahan se throw hone par poori
      // transaction rollback hoti hai (webhookEvent row bhi), controller 500 bhejta hai,
      // aur Razorpay thodi der baad dobara bhejta hai — tab order mil jayega.
      if (!found) throw new Error(`Order not found for Razorpay order ${payment.order_id}`);
      const order = await lockOrder(tx, found.id);

      if (order.paymentStatus !== "PENDING") {
        // Ek order pe doosri payment aa gayi — admin refund kare.
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

  // User (apna order) ya admin (userId nahi) — sirf PENDING/CONFIRMED aur bina payment wala.
  // Refund abhi app me nahi hai, isliye paid order yahan cancel nahi hota.
  async cancel(orderId: string, userId?: string) {
    // userId undefined chhod dene par Prisma filter hi gira deta hai — admin ke liye wahi
    // chahiye, par galti se undefined aa jaye to kisi aur ka order cancel ho sakta tha.
    const ownOrder = userId ? { id: orderId, userId } : { id: orderId };

    await prisma.$transaction(async (tx) => {
      const found = await tx.order.findFirst({ where: ownOrder, select: { id: true } });
      if (!found) throw new AppError("Order not found", 404);
      const order = await lockOrder(tx, orderId);

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

  // Admin: SHIPPED / DELIVERED. Cancel upar wale cancel() se.
  async updateStatus(orderId: string, status: OrderStatus) {
    if (status === "CANCELLED") return orderService.cancel(orderId);

    await prisma.$transaction(async (tx) => {
      const found = await tx.order.findUnique({ where: { id: orderId }, select: { id: true } });
      if (!found) throw new AppError("Order not found", 404);
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
          // COD: delivery = cash mil gaya.
          ...(status === "DELIVERED" &&
            order.paymentMethod === "COD" && { paymentStatus: "COMPLETED" as const }),
        },
      });
    });
  },

  // Admin ne Razorpay dashboard se refund kar diya — review band.
  async markRefunded(orderId: string) {
    await prisma.$transaction(async (tx) => {
      const found = await tx.order.findUnique({ where: { id: orderId }, select: { id: true } });
      if (!found) throw new AppError("Order not found", 404);
      const order = await lockOrder(tx, orderId);
      if (!order.needsReview) throw new AppError("Order does not need a refund", 409);

      await tx.order.update({
        where: { id: orderId },
        data: {
          needsReview: false,
          // Cancelled order ka poora paisa gaya. Confirmed order pe sirf doosri (extra) payment lauti.
          ...(order.status === "CANCELLED" && { paymentStatus: "REFUNDED" as const }),
        },
      });
    });
  },

  // Har minute (server.ts): deadline tak pay na hue online order cancel + stock wapas.
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
      // createdAt unique nahi — id se tie-break, warna page 2 pe order repeat/skip.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });
    return paginate(orders, limit);
  },

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
