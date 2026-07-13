import { Request, Response } from "express";
import { categoryService } from "../service/category.service";
import { asyncHandler } from "../utils/asyncHandler";

export const getCategoryTree = asyncHandler(
  async (_req: Request, res: Response) => {
    const tree = await categoryService.getTree();
    res.json({ success: true, data: tree });
  }
);
