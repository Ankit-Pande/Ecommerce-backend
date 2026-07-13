import { prisma } from "../config/db";
import { cartService } from "./cart.service";
import { orderService } from "./order.service";
import { buildTsQuery } from "./product.service";

// Assistant ke "tools" — sawal ka intent pakdo aur personal/admin data laao.
// Data hamesha existing services/DB se aata hai (LLM sirf bolne ke liye).

export type Intent =
  | "my_cart"          // user: mera cart
  | "my_orders"        // user: mere orders
  | "admin_user_lookup" // admin: kisi user ka cart/order (phone se)
  | "admin_stock"      // admin: stock/quantity numbers
  | "account_help"     // address/profile — app me kahan hai batao
  | "search";          // normal product search

// Sawal kis type ka hai — regex se, LLM ki zaroorat nahi (fast + free).
export function detectIntent(message: string, tier: "guest" | "user" | "admin"): Intent {
  const m = ` ${message.toLowerCase()} `;
  const hasPhone = /\b[6-9]\d{9}\b/.test(m);

  if (tier === "admin" && hasPhone && /(cart|order|user|customer|grahak)/.test(m))
    return "admin_user_lookup";
  if (tier === "admin" && /(stock|quantity|kitna bacha|kitne piece|kitna hai)/.test(m))
    return "admin_stock";
  if (/\bcart\b|meri cart|cart me/.test(m)) return "my_cart";
  if (/\borders?\b|mera order|order kahan|order status|order cancel|delivery kab/.test(m))
    return "my_orders";
  if (/\b(address|profile|account)\b/.test(m)) return "account_help";
  return "search";
}

// Chat widget me dikhane layak product card shape.
export type ChatProduct = {
  id: string; name: string; slug: string; pricePaise: number;
  discountPercent: number; images: string[]; stock: number;
};

// User ka apna cart — count, total, items (cards ke liye).
export async function myCartSummary(userId: string) {
  const cart = await cartService.getCart(userId);
  const products: ChatProduct[] = cart.items.slice(0, 5).map((i) => ({
    id: i.product.id,
    name: i.product.name,
    slug: i.product.slug,
    pricePaise: i.product.pricePaise,
    discountPercent: i.product.discountPercent,
    images: i.product.images,
    stock: i.product.stock,
  }));
  return {
    count: cart.items.length,
    totalPaise: cart.totalPaise,
    lastItem: cart.items[0]?.product.name ?? null, // getCart newest-first deta hai
    items: cart.items.map((i) => ({ name: i.product.name, qty: i.quantity })),
    products,
  };
}

type OrderRow = {
  id: string; totalPaise: number; status: string; paymentStatus: string;
  paymentMethod: string; createdAt: Date;
  items: { productName: string; quantity: number }[];
};

// User ke last 3 orders ka summary.
export async function myOrdersSummary(userId: string) {
  const res = await orderService.listForUser(userId, undefined, 3);
  return (res.items as OrderRow[]).map((o) => ({
    total: Math.round(o.totalPaise / 100),
    status: o.status,
    payment: o.paymentMethod === "COD" ? "COD" : `Online (${o.paymentStatus})`,
    itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
    firstItem: o.items[0]?.productName ?? "",
    date: o.createdAt,
  }));
}

// Admin: phone se kisi bhi user ka cart + orders (full power, numbers ke saath).
export async function adminUserLookup(message: string) {
  const phone = message.match(/\b([6-9]\d{9})\b/)?.[1];
  if (!phone) return null;
  const user = await prisma.user.findFirst({
    where: { phone: { endsWith: phone } },
    select: { id: true, name: true, phone: true, isBlocked: true },
  });
  if (!user) return { notFound: phone };
  const [cart, orders] = await Promise.all([
    myCartSummary(user.id),
    myOrdersSummary(user.id),
  ]);
  return { user: { name: user.name, phone: user.phone, isBlocked: user.isBlocked }, cart, orders };
}

// Admin: product ka exact stock — naam se dhoondo, numbers ke saath.
export async function adminStock(message: string) {
  // "stock" jaise words hata ke jo bacha usi se product dhoondo.
  const term = message
    .toLowerCase()
    .replace(/\b(stock|quantity|kitna|kitne|bacha|piece|hai|ka|ki|ke|check|karo|batao)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (term.length < 2) return [];
  // Full-text se dhoondo (search page wale hi word-variants) — admin ko hidden bhi dikhte hain.
  const tsq = buildTsQuery(term);
  if (!tsq) return [];
  return prisma.$queryRaw<
    { id: string; name: string; slug: string; pricePaise: number;
      discountPercent: number; images: string[]; stock: number; isActive: boolean }[]
  >`
    SELECT p.id, p.name, p.slug, p."pricePaise", p."discountPercent",
           p.images, p.stock, p."isActive"
    FROM "Product" p
    WHERE p."searchVector" @@ to_tsquery('simple', ${tsq})
    ORDER BY ts_rank(p."searchVector", to_tsquery('simple', ${tsq})) DESC
    LIMIT 3
  `;
}
