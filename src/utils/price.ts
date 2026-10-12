import { Prisma } from "@prisma/client";

const LOW_STOCK_AT = 5;

export const ACTIVE_CATEGORY = {
  isActive: true,
  OR: [{ parentId: null }, { parent: { isActive: true } }],
} satisfies Prisma.CategoryWhereInput;

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
  sizes: true,
  colors: true,
} satisfies Prisma.ProductSelect;

type CardRow = Prisma.ProductGetPayload<{ select: typeof CARD_SELECT }>;

function currentDiscount(discountPercent: number, offerEndsAt?: Date | null): number {
  if (offerEndsAt && offerEndsAt.getTime() <= Date.now()) return 0;
  return discountPercent;
}

export function finalPrice(pricePaise: number, discountPercent: number, offerEndsAt?: Date | null): number {
  const percent = currentDiscount(discountPercent, offerEndsAt);
  return pricePaise - Math.round((pricePaise * percent) / 10000) * 100;
}

export function stockStatus(stock: number): "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" {
  if (stock <= 0) return "OUT_OF_STOCK";
  if (stock <= LOW_STOCK_AT) return "LOW_STOCK";
  return "IN_STOCK";
}

export function productCard(p: CardRow) {
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
    rating: {
      average: p.ratingCount === 0 ? 0 : Math.round((p.ratingSum / p.ratingCount) * 10) / 10,
      count: p.ratingCount,
    },
    hasOptions: p.sizes.length > 0 || p.colors.length > 1,
  };
}
