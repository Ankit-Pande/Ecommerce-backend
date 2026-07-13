import { Request, Response } from "express";
import { productService } from "../service/product.service";
import { asyncHandler } from "../utils/asyncHandler";

// Listing query Zod (listProductSchema) se validate+coerce ho ke aati hai —
// is shape ki guarantee hoti hai jab tak route pe validate() laga hai.
type ListQuery = {
  q?: string;
  categoryId?: string;
  brandId?: string;
  color?: string;
  minPrice?: number;
  maxPrice?: number;
  sort: "newest" | "price_asc" | "price_desc";
  cursor?: string;
  limit: number;
};

// Listing + search + filter — sab ek endpoint (query params se decide hota hai).
export const listProducts = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await productService.list(
      req.query as unknown as ListQuery
    );
    res.json({ success: true, ...result });
  }
);

export const getProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await productService.getBySlug(req.params.slug);
  res.json({ success: true, data: product });
});

// Filter facets — current category/search me maujood brands + colors.
export const getFacets = asyncHandler(async (req: Request, res: Response) => {
  const { categoryId, q } = req.query as { categoryId?: string; q?: string };
  const data = await productService.facets(categoryId, q);
  res.json({ success: true, data });
});
