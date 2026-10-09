import { Request, Response } from "express";
import { homeService } from "../service/home.service";
import { asyncHandler } from "../utils/asyncHandler";

// Home page ka saara data.
export const getHome = asyncHandler(async (_req: Request, res: Response) => {
  const data = await homeService.getHome();
  res.json({ success: true, data });
});
