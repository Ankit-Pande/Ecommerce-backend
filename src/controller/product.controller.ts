import { Request, Response } from "express";
import { productService } from "../service/product.service";
import { reviewService } from "../service/review.service";
import { asyncHandler } from "../utils/asyncHandler";

// Product detail page ka data.
export const getProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await productService.getBySlug(req.params.slug);
  res.json({ success: true, data: product });
});

// Isi category ke aur products.
export const getRelatedProducts = asyncHandler(async (req: Request, res: Response) => {
  const products = await productService.getRelated(req.params.slug);
  res.json({ success: true, data: products });
});

// Product ke reviews.
export const listReviews = asyncHandler(async (req: Request, res: Response) => {
  const { cursor, limit } = req.query as unknown as { cursor?: string; limit: number };
  const result = await reviewService.list(req.params.slug, cursor, limit);
  res.json({ success: true, ...result });
});

// Review do ya badlo.
export const saveReview = asyncHandler(async (req: Request, res: Response) => {
  const review = await reviewService.save(req.user!.userId, req.params.slug, req.body.rating, req.body.comment);
  res.json({ success: true, data: review });
});
