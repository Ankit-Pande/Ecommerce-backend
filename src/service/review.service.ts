import { Prisma } from "@prisma/client";
import { lockProduct, prisma } from "../config/db";
import { AppError } from "../utils/appError";
import { clearStoreCache } from "../config/cache";
import { pageQuery, paginate } from "../utils/paginate";
import { ACTIVE_CATEGORY } from "../utils/price";

// Slug se chalu product ki id, na mile to 404.
async function activeProductId(slug: string) {
  const product = await prisma.product.findFirst({
    where: { slug, isActive: true, category: ACTIVE_CATEGORY },
    select: { id: true },
  });
  if (!product) throw new AppError("Product not found", 404);
  return product.id;
}

// Product ki rating ginti badlo aur average dobara nikalo.
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
  // Product ke review, naye pehle.
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
      ...pageQuery(cursor, limit),
    });
    return paginate(reviews, limit);
  },

  // Review do (sirf delivered order wala customer); dobara diya to purana update.
  async save(userId: string, slug: string, rating: number, comment?: string) {
    const productId = await activeProductId(slug);
    const deliveredItem = await prisma.orderItem.findFirst({
      where: { productId, order: { userId, status: "DELIVERED" } },
      select: { id: true },
    });
    if (!deliveredItem) throw new AppError("You can review a product only after its order is delivered.", 403);

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
    await clearStoreCache();
    return review;
  },

  // Admin galat review hataye aur product ki rating dobara nikale.
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
    await clearStoreCache();
  },
};
