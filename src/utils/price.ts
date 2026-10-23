import { Prisma } from "@prisma/client";

export const LOW_STOCK_AT = 5;

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

// The discount that applies right now: 0 once the offer end date has passed.
function currentDiscount(discountPercent: number, offerEndsAt?: Date | null): number {
  if (offerEndsAt && offerEndsAt.getTime() <= Date.now()) return 0;
  return discountPercent;
}

// The price after discount, rounded to whole rupees. This is the only discount formula in the app.
export function finalPrice(pricePaise: number, discountPercent: number, offerEndsAt?: Date | null): number {
  const percent = currentDiscount(discountPercent, offerEndsAt);
  const discountRupees = Math.round((pricePaise * percent) / 10000);
  return pricePaise - discountRupees * 100;
}

// Turns a stock number into the status shoppers see.
export function stockStatus(stock: number): "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" {
  if (stock <= 0) return "OUT_OF_STOCK";
  if (stock <= LOW_STOCK_AT) return "LOW_STOCK";
  return "IN_STOCK";
}

// The product card every customer-facing list sends (home, catalog, search, cart, assistant).
export function productCard(product: CardRow) {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    image: product.images[0] ?? null,
    pricePaise: product.pricePaise,
    offerEndsAt: product.offerEndsAt,
    discountPercent: currentDiscount(product.discountPercent, product.offerEndsAt),
    finalPricePaise: finalPrice(product.pricePaise, product.discountPercent, product.offerEndsAt),
    stockStatus: stockStatus(product.stock),
    rating: {
      average: product.ratingCount === 0 ? 0 : Math.round((product.ratingSum / product.ratingCount) * 10) / 10,
      count: product.ratingCount,
    },
    hasOptions: product.sizes.length > 0 || product.colors.length > 1,
  };
}
