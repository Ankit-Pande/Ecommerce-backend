import { z } from "zod";
import { prisma } from "../config/db";
import { GeminiTool } from "../integration/gemini";
import { AppError } from "../utils/appError";
import { uuid } from "../validation/common";
import { Card, findProducts, readQuestion } from "./assistant.search";
import { adminService } from "./admin.service";
import { cartService } from "./cart.service";
import { orderService } from "./order.service";

export type ToolUser = { userId: string; isAdmin: boolean };
type ToolOutput = { data: unknown; products?: Card[] };

type Tool = {
  declaration: GeminiTool;
  adminOnly?: boolean;
  schema: z.ZodTypeAny;
  confirmText?: (user: ToolUser, args: any) => Promise<string>;
  run: (user: ToolUser, args: any) => Promise<ToolOutput>;
};

const rupees = (paise: number) => Math.round(paise / 100);
const shortId = (id: string) => id.slice(0, 8).toUpperCase();
const LOW_STOCK_AT = 5;

// AI ko product ki chhoti jaankari do (id ke saath, taaki cart me daal sake).
const shortInfo = (card: Card) => ({
  id: card.id,
  name: card.name,
  priceRupees: rupees(card.finalPricePaise),
  discountPercent: card.discountPercent,
  rating: card.rating.average,
  stock: card.stockStatus,
});

// Tool ke inputs ka Gemini wala format.
const toolInputs = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "OBJECT",
  properties,
  required,
});

const TOOLS: Record<string, Tool> = {
  search_products: {
    declaration: {
      name: "search_products",
      description:
        "Search the store. Call once per product type (e.g. shoes, jeans, shirt separately). Query can include who it is for, budget and words like cheap/best/offer/trending.",
      parameters: toolInputs({ query: { type: "STRING" } }, ["query"]),
    },
    schema: z.object({ query: z.string().trim().min(2).max(120) }),
    async run(_user, args) {
      const { products } = await findProducts(readQuestion(args.query), 0);
      return { data: products.map(shortInfo), products };
    },
  },

  get_cart: {
    declaration: { name: "get_cart", description: "Items in the user's cart with total." },
    schema: z.object({}),
    async run(user) {
      const cart = await cartService.getCart(user.userId);
      return {
        data: {
          totalRupees: rupees(cart.totalPaise),
          items: cart.items.map((item) => ({ ...shortInfo(item.product), quantity: item.quantity })),
        },
      };
    },
  },

  add_to_cart: {
    declaration: {
      name: "add_to_cart",
      description: "Add a product (id from search_products) to the cart.",
      parameters: toolInputs({ productId: { type: "STRING" }, quantity: { type: "INTEGER" } }, ["productId"]),
    },
    schema: z.object({ productId: uuid, quantity: z.number().int().min(1).max(10).default(1) }),
    async run(user, args) {
      const cart = await cartService.addItem(user.userId, args.productId, args.quantity);
      return { data: { added: true, itemsInCart: cart.items.length } };
    },
  },

  remove_from_cart: {
    declaration: {
      name: "remove_from_cart",
      description: "Remove a product (id from get_cart) from the cart.",
      parameters: toolInputs({ productId: { type: "STRING" } }, ["productId"]),
    },
    schema: z.object({ productId: uuid }),
    async run(user, args) {
      const cart = await cartService.removeItem(user.userId, args.productId);
      return { data: { removed: true, itemsInCart: cart.items.length } };
    },
  },

  list_orders: {
    declaration: {
      name: "list_orders",
      description: "User's latest 5 orders, newest first. cancelled=true gives only cancelled orders.",
      parameters: toolInputs({ cancelled: { type: "BOOLEAN" } }),
    },
    schema: z.object({ cancelled: z.boolean().optional() }),
    async run(user, args) {
      const status = args.cancelled ? ["CANCELLED" as const] : undefined;
      const { items } = await orderService.listForUser(user.userId, status, undefined, 5);
      return {
        data: items.map((order) => ({
          orderId: order.id,
          orderNo: shortId(order.id),
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
      parameters: toolInputs({ orderId: { type: "STRING" } }, ["orderId"]),
    },
    schema: z.object({ orderId: uuid }),
    async confirmText(user, args) {
      const order = await orderService.getForUser(user.userId, args.orderId);
      return `Order #${shortId(order.id)} (₹${rupees(order.totalPaise)}) cancel karein?`;
    },
    async run(user, args) {
      await orderService.cancel(args.orderId, user.userId);
      return { data: { cancelled: true } };
    },
  },

  admin_find_products: {
    adminOnly: true,
    declaration: {
      name: "admin_find_products",
      description: "Admin: find products by name with stock, active, trending, featured and offer details.",
      parameters: toolInputs({ name: { type: "STRING" } }, ["name"]),
    },
    schema: z.object({ name: z.string().trim().min(2).max(120) }),
    async run(_user, args) {
      const rows = await prisma.product.findMany({
        where: { name: { contains: args.name, mode: "insensitive" } },
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
        take: 5,
      });
      return { data: rows.map(({ sellPaise, ...row }) => ({ ...row, priceRupees: rupees(sellPaise) })) };
    },
  },

  admin_low_stock: {
    adminOnly: true,
    declaration: { name: "admin_low_stock", description: `Admin: active products with stock ${LOW_STOCK_AT} or less.` },
    schema: z.object({}),
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
      parameters: toolInputs(
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
      .transform(({ endOffer, ...a }) => ({ ...a, ...(endOffer && { endOffer }) }))
      .refine((a) => Object.keys(a).length > 1, "Nothing to change"),
    async confirmText(_user, args) {
      const product = await prisma.product.findUnique({ where: { id: args.productId }, select: { name: true } });
      if (!product) throw new AppError("Product not found", 404);
      const { productId: _id, ...changes } = args;
      const list = Object.entries(changes)
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ");
      return `"${product.name}" me ye badlav karein? ${list}`;
    },
    async run(_user, args) {
      const { productId, endOffer, ...changes } = args;
      await adminService.updateProduct(
        productId,
        { ...changes, ...(endOffer && { discountPercent: 0, offerEndsAt: null }) },
        [],
      );
      return { data: { updated: true } };
    },
  },
};

// Role ke hisaab se tools (admin ko sab, user ko sirf apne).
export function toolsFor(user: ToolUser): GeminiTool[] {
  return Object.values(TOOLS)
    .filter((tool) => user.isAdmin || !tool.adminOnly)
    .map((tool) => tool.declaration);
}

// Tool ka naam aur uske input check karo; galat ho to null.
export function findTool(user: ToolUser, name: string, rawArgs: unknown) {
  const tool = TOOLS[name];
  if (!tool || (tool.adminOnly && !user.isAdmin)) return null;
  const args = tool.schema.safeParse(rawArgs ?? {});
  if (!args.success) return null;
  return { tool, args: args.data };
}
