import { Request, Response } from "express";
import { CatalogQuery, catalogService } from "../service/catalog.service";
import { asyncHandler } from "../utils/asyncHandler";

export const getCatalog = asyncHandler(async (req: Request, res: Response) => {
  const result = await catalogService.list(req.query as unknown as CatalogQuery);
  res.json({ success: true, ...result });
});
