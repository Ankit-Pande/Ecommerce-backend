import { Request, Response } from "express";
import { catalogService } from "../service/catalog.service";
import { asyncHandler } from "../utils/asyncHandler";

type CatalogQuery = Parameters<typeof catalogService.list>[0];

// Products ki list: search, filter, sort aur pages.
export const getCatalog = asyncHandler(async (req: Request, res: Response) => {
  const result = await catalogService.list(req.query as unknown as CatalogQuery);
  res.json({ success: true, ...result });
});
