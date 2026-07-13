import { PaymentMethod } from "@prisma/client";
import { prisma } from "../config/db";
import { razorpay } from "../integration/razorpay";
import { env } from "../config/env";
import { AppError } from "../utils/appError";
import { logger } from "../config/winston";
import { PaginatedResult } from "../types";

// Final price per unit (discount laga ke). Order item me yahi snapshot hota hai.
function discountedPrice(pricePaise: number, discountPercent: number): number {
  return pricePaise - Math.round((pricePaise * discountPercent) / 100);
}

export const orderService = {
  // Checkout flow:
  //  1. cart items + address validate
  //  2. ONLINE: pehle Razorpay order banao | COD: seedha aage
  //  3. ek transaction me: stock atomic kam (oversell rok), order + items snapshot,
  //     cart clear
  // ONLINE me stock reserve hota hai, payment fail pe webhook wapas badha dega.
  // COD me order seedha CONFIRMED (paisa delivery pe milega).
  async checkout(
    userId: string,
    addressId: string,
    paymentMethod: PaymentMethod
  ) {
    // Purane unpaid ONLINE orders ka reserved stock pehle chhoda do (leak fix).
    await this.releaseStaleOnlineOrders();

    const cart = await prisma.cart.findUnique({
      where: { userId },
      select: {
        id: true,
        items: {
          select: {
            quantity: true,
            product: {
              select: {
                id: true,
                name: true,
                pricePaise: true,
                discountPercent: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new AppError("Cart is empty", 400);
    }

    const address = await prisma.address.findFirst({
      where: { id: addressId, userId },
    });
    if (!address) throw new AppError("Address not found", 404);

    // Inactive products checkout me allow nahi.
    const activeItems = cart.items.filter((i) => i.product.isActive);
    if (activeItems.length === 0) {
      throw new AppError("Cart has no available products", 400);
    }

    const totalPaise = activeItems.reduce((sum, i) => {
      return (
        sum +
        discountedPrice(i.product.pricePaise, i.product.discountPercent) *
          i.quantity
      );
    }, 0);

    // ONLINE ho to Razorpay order pehle banao (DB transaction ke bahar — external call).
    // Edge case: agar neeche transaction fail ho (stock out), to yeh Razorpay order
    // "orphan" reh jaata hai — par user ne pay nahi kiya, paisa safe. Razorpay khud
    // expire kar deta hai, isliye medium-scale pe extra cleanup ki zaroorat nahi.
    let rzpOrderId: string | null = null;
    if (paymentMethod === "ONLINE") {
      const rzpOrder = await razorpay.orders.create({
        amount: totalPaise,
        currency: "INR",
        receipt: `rcpt_${cart.id.slice(0, 30)}`,
      });
      rzpOrderId = rzpOrder.id;
    }

    // Ab DB transaction — stock atomic kam + order + items + cart clear.
    const order = await prisma.$transaction(async (tx) => {
      // Har product ka stock atomic decrement. updateMany with stock>=qty guard:
      // count 0 aaya matlab stock kam tha -> poora transaction rollback (oversell rok).
      for (const item of activeItems) {
        const updated = await tx.product.updateMany({
          where: { id: item.product.id, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (updated.count === 0) {
          throw new AppError(
            `"${item.product.name}" out of stock`,
            409
          );
        }
      }

      const created = await tx.order.create({
        data: {
          userId,
          addressId,
          shipName: address.fullName,
          shipPhone: address.phone,
          shipLine1: address.line1,
          shipLine2: address.line2,
          shipCity: address.city,
          shipState: address.state,
          shipPincode: address.pincode,
          totalPaise,
          paymentMethod,
          // COD: order seedha CONFIRMED, paisa delivery pe (paymentStatus PENDING).
          ...(paymentMethod === "COD" && { status: "CONFIRMED" as const }),
          razorpayOrderId: rzpOrderId,
          items: {
            create: activeItems.map((i) => ({
              productId: i.product.id,
              productName: i.product.name,
              pricePaise: discountedPrice(
                i.product.pricePaise,
                i.product.discountPercent
              ),
              quantity: i.quantity,
            })),
          },
        },
        select: { id: true, totalPaise: true, razorpayOrderId: true },
      });

      // Cart clear.
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return created;
    });

    return {
      orderId: order.id,
      amount: order.totalPaise,
      paymentMethod,
      razorpayOrderId: order.razorpayOrderId, // COD me null
      razorpayKeyId: paymentMethod === "ONLINE" ? env.RAZORPAY_KEY_ID : null,
    };
  },

  // Webhook se aata hai — payment success/fail. Idempotent: dobara aaye to skip.
  async handlePaymentSuccess(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    signature: string
  ) {
    const order = await prisma.order.findUnique({
      where: { razorpayOrderId },
      select: { id: true, paymentStatus: true, status: true },
    });
    if (!order) {
      logger.warn(`Webhook: unknown razorpay order ${razorpayOrderId}`);
      return;
    }
    if (order.paymentStatus === "COMPLETED") return; // already handled

    // Order cancel ho chuka hai (user/admin/stale-cleanup) aur payment baad me aayi —
    // order CONFIRMED wapas NAHI karna (stock restore ho chuka). Payment record karo,
    // admin ko manual refund karna hoga (CANCELLED + COMPLETED = refund pending).
    if (order.status === "CANCELLED") {
      await prisma.order.update({
        where: { razorpayOrderId },
        data: {
          paymentStatus: "COMPLETED",
          razorpayPaymentId,
          razorpaySignature: signature,
        },
      });
      logger.warn(`Payment received for cancelled order ${order.id} — manual refund needed`);
      return;
    }

    await prisma.order.update({
      where: { razorpayOrderId },
      data: {
        paymentStatus: "COMPLETED",
        status: "CONFIRMED",
        razorpayPaymentId,
        razorpaySignature: signature,
      },
    });
  },

  // Payment fail — stock wapas badhao (checkout pe reserve hua tha), order cancel.
  async handlePaymentFailed(razorpayOrderId: string) {
    const order = await prisma.order.findUnique({
      where: { razorpayOrderId },
      select: { id: true, paymentStatus: true, status: true },
    });
    if (!order) return;
    if (order.status === "CANCELLED" || order.paymentStatus === "COMPLETED") {
      return; // already settled
    }

    await prisma.$transaction(async (tx) => {
      const items = await tx.orderItem.findMany({
        where: { orderId: order.id },
        select: { productId: true, quantity: true },
      });
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
      await tx.order.update({
        where: { id: order.id },
        data: { paymentStatus: "FAILED", status: "CANCELLED" },
      });
    });
  },

  // User apna order cancel kare — sirf PENDING/CONFIRMED tak (SHIPPED ke baad nahi).
  // Stock wapas badhta hai. Paid ONLINE order cancel ho to refund admin manually karega
  // (admin panel me CANCELLED + payment COMPLETED = refund pending dikh jaata hai).
  async cancelForUser(userId: string, orderId: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId },
      select: { id: true, status: true, paymentStatus: true },
    });
    if (!order) throw new AppError("Order not found", 404);
    if (order.status === "CANCELLED") {
      throw new AppError("Order is already cancelled", 400);
    }
    if (order.status === "SHIPPED" || order.status === "DELIVERED") {
      throw new AppError("Order already shipped, cannot cancel now", 400);
    }

    await prisma.$transaction(async (tx) => {
      // Guard: status abhi bhi cancel-able ho tabhi cancel (double-click/webhook race safe).
      const updated = await tx.order.updateMany({
        where: { id: order.id, status: { in: ["PENDING", "CONFIRMED"] } },
        data: { status: "CANCELLED" },
      });
      if (updated.count === 0) {
        throw new AppError("Order cannot be cancelled now", 409);
      }

      // Reserved stock wapas.
      const items = await tx.orderItem.findMany({
        where: { orderId: order.id },
        select: { productId: true, quantity: true },
      });
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
    });

    // Frontend ko batao refund message dikhana hai ya nahi.
    return { refundPending: order.paymentStatus === "COMPLETED" };
  },

  // ONLINE order banaya par pay nahi kiya (Razorpay popup band kar diya) to
  // payment.failed webhook kabhi nahi aata — stock reserved reh jaata. Isliye
  // 30 min se purane unpaid PENDING ONLINE orders cancel karke stock chhodo.
  // Checkout ke time chalta hai (chhota indexed query — cron ki zaroorat nahi).
  // Race safe: webhook ka CANCELLED guard payment late aane pe handle karta hai.
  async releaseStaleOnlineOrders() {
    try {
      const cutoff = new Date(Date.now() - 30 * 60 * 1000);
      const stale = await prisma.order.findMany({
        where: {
          paymentMethod: "ONLINE",
          status: "PENDING",
          paymentStatus: "PENDING",
          createdAt: { lt: cutoff },
        },
        select: { id: true },
        take: 20,
      });

      for (const o of stale) {
        await prisma.$transaction(async (tx) => {
          const updated = await tx.order.updateMany({
            where: { id: o.id, status: "PENDING" },
            data: { status: "CANCELLED", paymentStatus: "FAILED" },
          });
          if (updated.count === 0) return; // race me webhook confirm kar chuka

          const items = await tx.orderItem.findMany({
            where: { orderId: o.id },
            select: { productId: true, quantity: true },
          });
          for (const item of items) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: item.quantity } },
            });
          }
        });
      }
    } catch (err) {
      // Cleanup fail hone se checkout nahi rukna chahiye — log karke aage badho.
      logger.warn("Stale order cleanup failed", { err });
    }
  },

  // User ke orders — cursor pagination (newest first).
  async listForUser(
    userId: string,
    cursor: string | undefined,
    limit: number
  ): Promise<PaginatedResult<unknown>> {
    const orders = await prisma.order.findMany({
      where: { userId },
      select: {
        id: true,
        totalPaise: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        createdAt: true,
        items: {
          select: { productName: true, pricePaise: true, quantity: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });

    const hasMore = orders.length > limit;
    const sliced = hasMore ? orders.slice(0, limit) : orders;
    return {
      items: sliced,
      nextCursor: hasMore ? (sliced[sliced.length - 1] as { id: string }).id : null,
    };
  },

  async getForUser(userId: string, orderId: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId },
      select: {
        id: true,
        totalPaise: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        createdAt: true,
        shipName: true,
        shipPhone: true,
        shipLine1: true,
        shipLine2: true,
        shipCity: true,
        shipState: true,
        shipPincode: true,
        items: {
          select: { productName: true, pricePaise: true, quantity: true },
        },
      },
    });
    if (!order) throw new AppError("Order not found", 404);
    return order;
  },
};
