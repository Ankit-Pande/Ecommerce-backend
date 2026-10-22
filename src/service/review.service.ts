import { Prisma } from "@prisma/client";
import { lockProduct, prisma } from "../config/db";
import { clearCache } from "../config/redis";
import { AppError } from "../utils/appError";
import { pageQuery, paginate } from "../utils/paginate";
import { ACTIVE_CATEGORY } from "../utils/price";

// Changes the product's rating sum and count, then saves the new average.
async function changeRating(
  db: Prisma.TransactionClient,
  productId: string,
  ratingChange: number,
  countChange: number,
) {
  const product = await db.product.update({
    where: { id: productId },
    data: { ratingSum: { increment: ratingChange }, ratingCount: { increment: countChange } },
    select: { ratingSum: true, ratingCount: true },
  });
  await db.product.update({
    where: { id: productId },
    data: { ratingAverage: product.ratingCount > 0 ? product.ratingSum / product.ratingCount : 0 },
  });
}

export const reviewService = {
  // Reviews of a product, newest first.
  async list(slug: string, cursor: string | undefined, limit: number) {
    const reviews = await prisma.review.findMany({
      where: { product: { slug, isActive: true } },
      select: { id: true, rating: true, comment: true, createdAt: true, user: { select: { id: true, name: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...pageQuery(cursor, limit),
    });
    return paginate(reviews, limit);
  },

  // Adds or changes the user's review; only buyers whose order was delivered can review.
  async save(userId: string, slug: string, rating: number, comment?: string) {
    const product = await prisma.product.findFirst({
      where: { slug, isActive: true, category: ACTIVE_CATEGORY },
      select: { id: true },
    });
    if (!product) throw new AppError("Product not found", 404);
    const productId = product.id;

    const delivered = await prisma.orderItem.findFirst({
      where: { productId, order: { userId, status: "DELIVERED" } },
      select: { id: true },
    });
    if (!delivered) throw new AppError("You can review a product only after its order is delivered.", 403);

    const review = await prisma.$transaction(async (db) => {
      await lockProduct(db, productId);
      const previous = await db.review.findUnique({ where: { productId_userId: { productId, userId } } });
      const saved = await db.review.upsert({
        where: { productId_userId: { productId, userId } },
        create: { productId, userId, rating, comment },
        update: { rating, comment },
        select: { id: true, rating: true, comment: true, createdAt: true },
      });
      await changeRating(db, productId, rating - (previous?.rating ?? 0), previous ? 0 : 1);
      return saved;
    });
    await clearCache();
    return review;
  },

  // Deletes a review and takes its stars out of the product rating.
  async removeByAdmin(reviewId: string) {
    await prisma.$transaction(async (db) => {
      const found = await db.review.findUnique({ where: { id: reviewId }, select: { productId: true } });
      if (!found) throw new AppError("Review not found", 404);
      await lockProduct(db, found.productId);

      const review = await db.review.findUnique({ where: { id: reviewId }, select: { rating: true } });
      if (!review) throw new AppError("Review not found", 404);
      await db.review.delete({ where: { id: reviewId } });
      await changeRating(db, found.productId, -review.rating, -1);
    });
    await clearCache();
  },
};
