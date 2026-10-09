import { Request, Response } from "express";
import { catalogService } from "../service/catalog.service";
import { asyncHandler } from "../utils/asyncHandler";

type CatalogQuery = Parameters<typeof catalogService.list>[0];

// Products ki list: search, filter, sort aur pages.
export const getCatalog = asyncHandler(async (req: Request, res: Response) => {
  const result = await catalogService.list(req.query as unknown as CatalogQuery);
  res.json({ success: true, ...result });
});

// Sidebar ke filter (brand aur colour).
export const getFilters = asyncHandler(async (req: Request, res: Response) => {
  const { category, subcategory } = req.query as { category?: string; subcategory?: string };
  const data = await catalogService.filters({ category, subcategory });
  res.json({ success: true, data });
});
