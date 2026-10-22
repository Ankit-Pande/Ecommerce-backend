import { z } from "zod";
import { prisma } from "../config/db";
import { GeminiTool } from "../integration/gemini";
import { AppError } from "../utils/appError";
import { ACTIVE_CATEGORY, CARD_SELECT, LOW_STOCK_AT, productCard } from "../utils/price";
import { uuid } from "../validation/common";
import { adminService } from "./admin.service";
import { Card, findProducts, readQuestion } from "./assistant.search";
import { cartService } from "./cart.service";
import { checkCanCancel, orderService } from "./order.service";
import { userService } from "./user.service";

export type ToolUser = { userId: string; isAdmin: boolean };
export type Language = "hi" | "en";

type Tool = {
  declaration: GeminiTool;
  adminOnly?: boolean;
  schema: z.ZodTypeAny;
  confirmText?: (user: ToolUser, input: any, language: Language) => Promise<string>;
  run: (user: ToolUser, input: any) => Promise<{ data: unknown; products?: Card[] }>;
};

const ORDER_STATUSES = ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"] as const;

// Paise to whole rupees for the AI model.
function rupees(paise: number) {
  return Math.round(paise / 100);
}

// The order number shoppers see: the first 8 characters of the id.
function orderNumber(id: string) {
  return id.slice(0, 8).toUpperCase();
}

// A tool's input description in Gemini's format.
function inputSchema(properties: Record<string, unknown>, required: string[] = []) {
  return { type: "OBJECT", properties, required };
}

// The few product fields the AI model needs.
function productSummary(card: ReturnType<typeof productCard>) {
  return {
    id: card.id,
    name: card.name,
    priceRupees: rupees(card.finalPricePaise),
    discountPercent: card.discountPercent,
    rating: card.rating.average,
    stock: card.stockStatus,
  };
}

const TOOLS: Record<string, Tool> = {
  search_products: {
    declaration: {
      name: "search_products",
      description:
        "Search the store. Call once per product type (e.g. shoes, jeans, shirt separately). Query can include who it is for, budget and words like cheap/best/offer/trending.",
      parameters: inputSchema({ query: { type: "STRING" } }, ["query"]),
    },
    schema: z.object({ query: z.string().trim().min(2).max(120) }),
    // Searches with the same engine as the store search.
    async run(_user, input) {
      const { products } = await findProducts(await readQuestion(input.query), 0);
      return { data: products.map(productSummary), products };
    },
  },

  get_product: {
    declaration: {
      name: "get_product",
      description: "Full details and latest reviews of one product (id from search_products or get_cart).",
      parameters: inputSchema({ productId: { type: "STRING" } }, ["productId"]),
    },
    schema: z.object({ productId: uuid }),
    // Loads one visible product with its latest 3 reviews.
    async run(_user, input) {
      const product = await prisma.product.findFirst({
        where: { id: input.productId, isActive: true, category: ACTIVE_CATEGORY },
        select: {
          ...CARD_SELECT,
          gender: true,
          ageGroup: true,
          description: true,
          specs: true,
          brand: { select: { name: true } },
          category: { select: { name: true } },
          reviews: { select: { rating: true, comment: true }, orderBy: { createdAt: "desc" }, take: 3 },
        },
      });
      if (!product) throw new AppError("Product not found", 404);

      const card = { ...productCard(product), gender: product.gender, ageGroup: product.ageGroup };
      return {
        data: {
          ...productSummary(card),
          brand: product.brand?.name,
          category: product.category.name,
          colors: product.colors,
          sizes: product.sizes,
          specs: product.specs,
          description: product.description.slice(0, 400),
          ratingCount: card.rating.count,
          latestReviews: product.reviews,
        },
        products: [card],
      };
    },
  },

  get_profile: {
    declaration: { name: "get_profile", description: "The user's own profile: name, phone, email." },
    schema: z.object({}),
    // Reads the user's own profile.
    async run(user) {
      const { name, phone, email, createdAt } = await userService.getMe(user.userId);
      return { data: { name, phone, email, memberSince: createdAt.toISOString().slice(0, 10) } };
    },
  },

  get_cart: {
    declaration: { name: "get_cart", description: "Items in the user's cart with total." },
    schema: z.object({}),
    // Lists the cart lines with their item ids.
    async run(user) {
      const cart = await cartService.getCart(user.userId);
      return {
        data: {
          totalRupees: rupees(cart.totalPaise),
          items: cart.items.map((item) => ({
            itemId: item.id,
            ...productSummary(item.product),
            quantity: item.quantity,
            size: item.size || undefined,
            color: item.color || undefined,
          })),
        },
      };
    },
  },

  add_to_cart: {
    declaration: {
      name: "add_to_cart",
      description:
        "Add a product (id from search_products) to the cart. If the product has sizes or many colours (see get_product), ask the user which one first.",
      parameters: inputSchema(
        {
          productId: { type: "STRING" },
          quantity: { type: "INTEGER" },
          size: { type: "STRING" },
          color: { type: "STRING" },
        },
        ["productId"],
      ),
    },
    schema: z.object({
      productId: uuid,
      quantity: z.number().int().min(1).max(10).default(1),
      size: z.string().max(30).optional(),
      color: z.string().max(30).optional(),
    }),
    // Adds the product with the normal cart rules (size, colour, stock).
    async run(user, input) {
      const cart = await cartService.addItem(user.userId, input.productId, input.quantity, {
        size: input.size,
        color: input.color,
      });
      return { data: { added: true, itemsInCart: cart.items.length } };
    },
  },

  remove_from_cart: {
    declaration: {
      name: "remove_from_cart",
      description: "Remove one cart line (itemId from get_cart) from the cart.",
      parameters: inputSchema({ itemId: { type: "STRING" } }, ["itemId"]),
    },
    schema: z.object({ itemId: uuid }),
    // Removes one cart line.
    async run(user, input) {
      const cart = await cartService.removeItem(user.userId, input.itemId);
      return { data: { removed: true, itemsInCart: cart.items.length } };
    },
  },

  clear_cart: {
    declaration: {
      name: "clear_cart",
      description: "Remove every item from the user's cart. The user must confirm first.",
    },
    schema: z.object({}),
    // Asks before emptying the cart (fails when it is already empty).
    async confirmText(user, _input, language) {
      const count = (await cartService.getCart(user.userId)).items.length;
      const hindi = language === "hi";
      if (count === 0) throw new AppError(hindi ? "Cart pehle se khali hai." : "Your cart is already empty.");
      return hindi ? `Cart ke saare ${count} items hata du?` : `Remove all ${count} items from your cart?`;
    },
    // Empties the cart.
    async run(user) {
      await cartService.clear(user.userId);
      return { data: { cleared: true } };
    },
  },

  list_orders: {
    declaration: {
      name: "list_orders",
      description: "User's latest 5 orders, newest first. cancelled=true gives only cancelled orders.",
      parameters: inputSchema({ cancelled: { type: "BOOLEAN" } }),
    },
    schema: z.object({ cancelled: z.boolean().optional() }),
    // Lists the user's latest 5 orders.
    async run(user, input) {
      const { items } = await orderService.listForUser(
        user.userId,
        input.cancelled ? ["CANCELLED"] : undefined,
        undefined,
        5,
      );
      return {
        data: items.map((order) => ({
          orderId: order.id,
          orderNumber: orderNumber(order.id),
          status: order.status,
          payment: order.paymentStatus,
          totalRupees: rupees(order.totalPaise),
          date: order.createdAt.toISOString().slice(0, 10),
          items: order.items.map((item) => `${item.productName} x${item.quantity}`),
        })),
      };
    },
  },

  cancel_order: {
    declaration: {
      name: "cancel_order",
      description: "Cancel one of the user's orders (orderId from list_orders). The user must confirm first.",
      parameters: inputSchema({ orderId: { type: "STRING" } }, ["orderId"]),
    },
    schema: z.object({ orderId: uuid }),
    // Asks before cancelling (fails when the order cannot be cancelled).
    async confirmText(user, input, language) {
      const order = await orderService.getForUser(user.userId, input.orderId);
      checkCanCancel(order);
      const shown = `#${orderNumber(order.id)} (₹${rupees(order.totalPaise)})`;
      return language === "hi" ? `Order ${shown} cancel karein?` : `Cancel order ${shown}?`;
    },
    // Cancels the order with the normal order rules.
    async run(user, input) {
      await orderService.cancel(input.orderId, user.userId);
      return { data: { cancelled: true } };
    },
  },

  admin_find_products: {
    adminOnly: true,
    declaration: {
      name: "admin_find_products",
      description:
        "Admin: products with stock, active, trending, featured and offer details. Find by name, or list trending=true / featured=true products.",
      parameters: inputSchema({
        name: { type: "STRING" },
        trending: { type: "BOOLEAN" },
        featured: { type: "BOOLEAN" },
      }),
    },
    schema: z
      .object({
        name: z.string().trim().min(2).max(120).optional(),
        trending: z.boolean().optional(),
        featured: z.boolean().optional(),
      })
      .refine((input) => input.name || input.trending || input.featured, "Give a name, trending or featured"),
    // Finds up to 10 products by name, trending or featured.
    async run(_user, input) {
      const rows = await prisma.product.findMany({
        where: {
          ...(input.name && { name: { contains: input.name, mode: "insensitive" } }),
          ...(input.trending && { isTrending: true }),
          ...(input.featured && { isFeatured: true }),
        },
        select: {
          id: true,
          name: true,
          stock: true,
          isActive: true,
          isTrending: true,
          isFeatured: true,
          discountPercent: true,
          sellPaise: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 10,
      });
      return { data: rows.map(({ sellPaise, ...row }) => ({ ...row, priceRupees: rupees(sellPaise) })) };
    },
  },

  admin_orders: {
    adminOnly: true,
    declaration: {
      name: "admin_orders",
      description:
        "Admin: latest 10 orders. status CONFIRMED = to ship, PENDING = payment pending; needsReview=true = orders to check.",
      parameters: inputSchema({ status: { type: "STRING", enum: ORDER_STATUSES }, needsReview: { type: "BOOLEAN" } }),
    },
    schema: z.object({ status: z.enum(ORDER_STATUSES).optional(), needsReview: z.boolean().optional() }),
    // Lists the latest 10 orders for the given filters.
    async run(_user, input) {
      const { items } = await adminService.listOrders({ ...input, limit: 10 });
      return {
        data: items.map((order) => ({
          orderId: order.id,
          orderNumber: orderNumber(order.id),
          status: order.status,
          payment: `${order.paymentMethod} ${order.paymentStatus}`,
          totalRupees: rupees(order.totalPaise),
          date: order.createdAt.toISOString().slice(0, 10),
          customer: order.shipName,
          needsReview: order.needsReview,
        })),
      };
    },
  },

  admin_find_users: {
    adminOnly: true,
    declaration: {
      name: "admin_find_users",
      description: "Admin: find customers by phone number (full or part).",
      parameters: inputSchema({ phone: { type: "STRING" } }, ["phone"]),
    },
    schema: z.object({ phone: z.string().regex(/^\d{3,10}$/) }),
    // Finds up to 5 customers by phone.
    async run(_user, input) {
      const { items } = await adminService.listUsers({ q: input.phone, limit: 5 });
      return {
        data: items.map((row) => ({
          userId: row.id,
          name: row.name,
          phone: row.phone,
          role: row.role,
          blocked: row.isBlocked,
          joined: row.createdAt.toISOString().slice(0, 10),
        })),
      };
    },
  },

  admin_low_stock: {
    adminOnly: true,
    declaration: { name: "admin_low_stock", description: `Admin: active products with stock ${LOW_STOCK_AT} or less.` },
    schema: z.object({}),
    // Lists up to 10 active products with low stock.
    async run() {
      const rows = await prisma.product.findMany({
        where: { isActive: true, stock: { lte: LOW_STOCK_AT } },
        select: { id: true, name: true, stock: true },
        orderBy: { stock: "asc" },
        take: 10,
      });
      return { data: rows };
    },
  },

  admin_stats: {
    adminOnly: true,
    declaration: { name: "admin_stats", description: "Admin: today's orders, revenue and pending work." },
    schema: z.object({}),
    // Reads today's store numbers.
    async run() {
      const stats = await adminService.getStats();
      return { data: { ...stats, revenueTodayRupees: rupees(stats.revenueTodayPaise) } };
    },
  },

  admin_update_product: {
    adminOnly: true,
    declaration: {
      name: "admin_update_product",
      description:
        "Admin: change a product (id from admin_find_products): trending, featured, active (show/hide), stock, or endOffer=true to remove its discount. Admin must confirm first.",
      parameters: inputSchema(
        {
          productId: { type: "STRING" },
          isTrending: { type: "BOOLEAN" },
          isFeatured: { type: "BOOLEAN" },
          isActive: { type: "BOOLEAN" },
          stock: { type: "INTEGER" },
          endOffer: { type: "BOOLEAN" },
        },
        ["productId"],
      ),
    },
    schema: z
      .object({
        productId: uuid,
        isTrending: z.boolean().optional(),
        isFeatured: z.boolean().optional(),
        isActive: z.boolean().optional(),
        stock: z.number().int().min(0).max(100000).optional(),
        endOffer: z.boolean().optional(),
      })
      .transform(({ endOffer, ...rest }) => ({ ...rest, ...(endOffer && { endOffer }) }))
      .refine((input) => Object.keys(input).length > 1, "Nothing to change"),
    // Asks before changing the product and lists the changes.
    async confirmText(_user, input, language) {
      const product = await prisma.product.findUnique({ where: { id: input.productId }, select: { name: true } });
      if (!product) throw new AppError("Product not found", 404);
      const { productId: _productId, ...changes } = input;
      const list = Object.entries(changes)
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ");
      return language === "hi" ? `"${product.name}" me ye badlav karein? ${list}` : `Change "${product.name}"? ${list}`;
    },
    // Saves the changes; endOffer removes the discount.
    async run(_user, input) {
      const { productId, endOffer, ...changes } = input;
      await adminService.updateProduct(
        productId,
        { ...changes, ...(endOffer && { discountPercent: 0, offerEndsAt: null }) },
        [],
      );
      return { data: { updated: true } };
    },
  },
};

// The tools this user may use (admin tools only for admins).
export function toolsFor(user: ToolUser): GeminiTool[] {
  return Object.values(TOOLS)
    .filter((tool) => user.isAdmin || !tool.adminOnly)
    .map((tool) => tool.declaration);
}

// The tool with its checked input, or null when the tool is unknown, not allowed or the input is wrong.
export function findTool(user: ToolUser, name: string, rawInput: unknown) {
  const tool = TOOLS[name];
  if (!tool || (tool.adminOnly && !user.isAdmin)) return null;
  const parsed = tool.schema.safeParse(rawInput ?? {});
  if (!parsed.success) return null;
  return { tool, input: parsed.data };
}
