import { Prisma } from "@prisma/client";

// Product tabhi dikhe jab uski category aur parent category dono chalu hon.
export const ACTIVE_CATEGORY = {
  isActive: true,
  OR: [{ parentId: null }, { parent: { isActive: true } }],
} satisfies Prisma.CategoryWhereInput;

const LOW_STOCK_AT = 5;

// Aaj ka discount: offer ki date nikal gayi to 0.
function currentDiscount(discountPercent: number, offerEndsAt?: Date | null): number {
  if (offerEndsAt && offerEndsAt.getTime() <= Date.now()) return 0;
  return discountPercent;
}

// Discount ke baad ka price (paise me); discount poore rupee me katta hai, taaki ₹259.48 jaisa daam na bane.
export function finalPrice(pricePaise: number, discountPercent: number, offerEndsAt?: Date | null): number {
  const percent = currentDiscount(discountPercent, offerEndsAt);
  return pricePaise - Math.round((pricePaise * percent) / 10000) * 100;
}

// Customer ko poora stock number nahi, sirf "hai / kam hai / khatam" dikhta hai.
export function stockStatus(stock: number): "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" {
  if (stock <= 0) return "OUT_OF_STOCK";
  if (stock <= LOW_STOCK_AT) return "LOW_STOCK";
  return "IN_STOCK";
}

// Average rating (jaise 4.3) aur kitne logon ne di.
function ratingInfo(sum: number, count: number) {
  return { average: count === 0 ? 0 : Math.round((sum / count) * 10) / 10, count };
}

// Product card ke liye DB se sirf ye fields lo.
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

// Har jagah (home, catalog, cart) product card ek jaisa dikhe.
export function productCard(p: Prisma.ProductGetPayload<{ select: typeof CARD_SELECT }>) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    image: p.images[0] ?? null,
    pricePaise: p.pricePaise,
    offerEndsAt: p.offerEndsAt,
    discountPercent: currentDiscount(p.discountPercent, p.offerEndsAt),
    finalPricePaise: finalPrice(p.pricePaise, p.discountPercent, p.offerEndsAt),
    stockStatus: stockStatus(p.stock),
    rating: ratingInfo(p.ratingSum, p.ratingCount),
  };
}
