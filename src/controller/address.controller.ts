import { Request, Response } from "express";
import { addressService } from "../service/address.service";
import { asyncHandler } from "../utils/asyncHandler";

// User ke saare address do.
export const listAddresses = asyncHandler(async (req: Request, res: Response) => {
  const addresses = await addressService.list(req.user!.userId);
  res.json({ success: true, data: addresses });
});

// Naya address jodo.
export const createAddress = asyncHandler(async (req: Request, res: Response) => {
  const address = await addressService.create(req.user!.userId, req.body);
  res.status(201).json({ success: true, data: address });
});

// Address badlo.
export const updateAddress = asyncHandler(async (req: Request, res: Response) => {
  const address = await addressService.update(req.user!.userId, req.params.id, req.body);
  res.json({ success: true, data: address });
});

// Address hatao.
export const deleteAddress = asyncHandler(async (req: Request, res: Response) => {
  await addressService.remove(req.user!.userId, req.params.id);
  res.json({ success: true, message: "Address deleted" });
});
