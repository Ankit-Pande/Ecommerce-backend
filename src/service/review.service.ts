import { Prisma } from "@prisma/client";
import { prisma } from "../config/db";
import { AppError } from "../utils/appError";
import { bumpStorefrontCache } from "../config/cache";
import { paginate } from "../utils/paginate";
import { ACTIVE_CATEGORY } from "../utils/price";

async function activeProductId(slug: string) {
  const product = await prisma.product.findFirst({
    where: { slug, isActive: true, category: ACTIVE_CATEGORY },
    select: { id: true },
  });
  if (!product) throw new AppError("Product not found", 404);
  return product.id;
}

// Product row lock. Review likhna aur hataana dono isse shuru hote hain, warna ek saath
// chalne par ratingSum/ratingCount ki ginti galat ho jaati hai.
async function lockProduct(tx: Prisma.TransactionClient, productId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Product" WHERE "id" = ${productId} FOR UPDATE`;
}

// Rating sum/count badlo aur average dobara nikaalo (update row lock le leta hai).
async function changeRating(
  tx: Prisma.TransactionClient,
  productId: string,
  ratingChange: number,
  countChange: number,
) {
  const product = await tx.product.update({
    where: { id: productId },
    data: { ratingSum: { increment: ratingChange }, ratingCount: { increment: countChange } },
    select: { ratingSum: true, ratingCount: true },
  });
  await tx.product.update({
    where: { id: productId },
    data: { ratingAverage: product.ratingCount > 0 ? product.ratingSum / product.ratingCount : 0 },
  });
}

export const reviewService = {
  // Naye review pehle. user.id frontend ko "meri review" pehchanne ke liye.
  async list(slug: string, cursor: string | undefined, limit: number) {
    const reviews = await prisma.review.findMany({
      where: { product: { slug, isActive: true } },
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        user: { select: { id: true, name: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });
    return paginate(reviews, limit);
  },

  // Sirf delivered order wala customer review de sakta hai (fake rating nahi).
  // Dobara diya to purana review update hota hai.
  async save(userId: string, slug: string, rating: number, comment?: string) {
    const productId = await activeProductId(slug);
    const delivered = await prisma.orderItem.findFirst({
      where: { productId, order: { userId, status: "DELIVERED" } },
      select: { id: true },
    });
    if (!delivered) throw new AppError("You can review a product only after its order is delivered.", 403);

    const review = await prisma.$transaction(async (tx) => {
      await lockProduct(tx, productId);
      const old = await tx.review.findUnique({ where: { productId_userId: { productId, userId } } });
      const saved = await tx.review.upsert({
        where: { productId_userId: { productId, userId } },
        create: { productId, userId, rating, comment },
        update: { rating, comment },
        select: { id: true, rating: true, comment: true, createdAt: true },
      });
      await changeRating(tx, productId, rating - (old?.rating ?? 0), old ? 0 : 1);
      return saved;
    });
    await bumpStorefrontCache();
    return review;
  },

  async remove(userId: string, slug: string) {
    const productId = await activeProductId(slug);
    await prisma.$transaction(async (tx) => {
      await lockProduct(tx, productId);
      const review = await tx.review.findUnique({ where: { productId_userId: { productId, userId } } });
      if (!review) throw new AppError("Review not found", 404);
      await tx.review.delete({ where: { id: review.id } });
      await changeRating(tx, productId, -review.rating, -1);
    });
    await bumpStorefrontCache();
  },

  // Admin: galat/abusive review hatao.
  async removeByAdmin(reviewId: string) {
    await prisma.$transaction(async (tx) => {
      const found = await tx.review.findUnique({ where: { id: reviewId }, select: { productId: true } });
      if (!found) throw new AppError("Review not found", 404);
      await lockProduct(tx, found.productId);

      // Lock milne tak user ne khud hata di ya rating badal di ho sakti hai — dobara padho.
      const review = await tx.review.findUnique({ where: { id: reviewId }, select: { rating: true } });
      if (!review) throw new AppError("Review not found", 404);
      await tx.review.delete({ where: { id: reviewId } });
      await changeRating(tx, found.productId, -review.rating, -1);
    });
    await bumpStorefrontCache();
  },
};
