import { Request, Response } from "express";
import { brandService } from "../service/brand.service";
import { asyncHandler } from "../utils/asyncHandler";

export const getBrands = asyncHandler(async (_req: Request, res: Response) => {
  const brands = await brandService.getAll();
  res.json({ success: true, data: brands });
});
