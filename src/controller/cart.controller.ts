import { Request, Response } from "express";
import { cartService } from "../service/cart.service";
import { asyncHandler } from "../utils/asyncHandler";

export const getCart = asyncHandler(async (req: Request, res: Response) => {
  const cart = await cartService.getCart(req.user!.userId);
  res.json({ success: true, data: cart });
});

export const addToCart = asyncHandler(async (req: Request, res: Response) => {
  const cart = await cartService.addItem(req.user!.userId, req.body.productId, req.body.quantity);
  res.json({ success: true, data: cart });
});

export const updateCartItem = asyncHandler(async (req: Request, res: Response) => {
  const cart = await cartService.updateItem(req.user!.userId, req.params.productId, req.body.quantity);
  res.json({ success: true, data: cart });
});

export const removeCartItem = asyncHandler(async (req: Request, res: Response) => {
  const cart = await cartService.removeItem(req.user!.userId, req.params.productId);
  res.json({ success: true, data: cart });
});

