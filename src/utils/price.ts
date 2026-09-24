import { Prisma } from "@prisma/client";

// Product tabhi public hai jab uski category aur parent category dono active hon.
export const ACTIVE_CATEGORY = {
  isActive: true,
  OR: [{ parentId: null }, { parent: { isActive: true } }],
} satisfies Prisma.CategoryWhereInput;

// Isse kam stock = "kam bacha" (admin panel filter bhi yahi).
export const LOW_STOCK_AT = 5;

// Offer ki deadline nikal gayi to discount 0 — minute wali sweep chali ho ya nahi.
export function effectiveDiscount(discountPercent: number, offerEndsAt?: Date | string | null): number {
  if (offerEndsAt && new Date(offerEndsAt).getTime() <= Date.now()) return 0;
  return discountPercent;
}

export function finalPrice(
  pricePaise: number,
  discountPercent: number,
  offerEndsAt?: Date | string | null,
): number {
  const percent = effectiveDiscount(discountPercent, offerEndsAt);
  return pricePaise - Math.round((pricePaise * percent) / 100);
}

// Customer ko exact stock nahi dikhate, sirf status.
export function stockStatus(stock: number): "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" {
  if (stock <= 0) return "OUT_OF_STOCK";
  if (stock <= LOW_STOCK_AT) return "LOW_STOCK";
  return "IN_STOCK";
}

export function rating(sum: number, count: number) {
  return { average: count === 0 ? 0 : Math.round((sum / count) * 10) / 10, count };
}

// Home, catalog, related, recently-viewed, batch — sabka ek hi product card.
// Har list yahi bhejti hai, taaki frontend ek hi component se kaam chala sake.
export function productCard(p: {
  id: string;
  name: string;
  slug: string;
  images: string[];
  pricePaise: number;
  discountPercent: number;
  offerEndsAt: Date | null;
  stock: number;
  ratingSum: number;
  ratingCount: number;
}) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    image: p.images[0] ?? null,
    pricePaise: p.pricePaise,
    offerEndsAt: p.offerEndsAt,
    discountPercent: effectiveDiscount(p.discountPercent, p.offerEndsAt),
    finalPricePaise: finalPrice(p.pricePaise, p.discountPercent, p.offerEndsAt),
    stockStatus: stockStatus(p.stock),
    rating: rating(p.ratingSum, p.ratingCount),
  };
}
