import { Prisma } from "@prisma/client";

// Product tabhi dikhe jab uski category aur parent category dono chalu hon.
export const ACTIVE_CATEGORY = {
  isActive: true,
  OR: [{ parentId: null }, { parent: { isActive: true } }],
} satisfies Prisma.CategoryWhereInput;

export const LOW_STOCK_AT = 5;

// Offer ki date nikal gayi to discount 0.
function effectiveDiscount(discountPercent: number, offerEndsAt?: Date | null): number {
  if (offerEndsAt && offerEndsAt.getTime() <= Date.now()) return 0;
  return discountPercent;
}

// Discount ke baad ka price (paise me). Discount poore rupee me kat-ta hai,
// taki customer ko ₹259.48 jaisa ajeeb daam na dikhe.
export function finalPrice(pricePaise: number, discountPercent: number, offerEndsAt?: Date | null): number {
  const percent = effectiveDiscount(discountPercent, offerEndsAt);
  return pricePaise - Math.round((pricePaise * percent) / 10000) * 100;
}

// Customer ko exact stock nahi, sirf status dikhta hai.
export function stockStatus(stock: number): "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" {
  if (stock <= 0) return "OUT_OF_STOCK";
  if (stock <= LOW_STOCK_AT) return "LOW_STOCK";
  return "IN_STOCK";
}

// Average rating (1 decimal) aur kitne review.
function rating(sum: number, count: number) {
  return { average: count === 0 ? 0 : Math.round((sum / count) * 10) / 10, count };
}

// Product card ke liye DB se ye fields mangao.
export const CARD_SELECT = {
  id: true,
  name: true,
  slug: true,
  images: true,
  pricePaise: true,
  discountPercent: true,
  offerEndsAt: true,
  stock: true,
  ratingSum: true,
  ratingCount: true,
} satisfies Prisma.ProductSelect;

// Har list (home, catalog, cart...) ka ek hi product card shape.
export function productCard(p: Prisma.ProductGetPayload<{ select: typeof CARD_SELECT }>) {
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
