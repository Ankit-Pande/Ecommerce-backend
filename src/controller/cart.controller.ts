import { Request, Response } from "express";
import { cartService } from "../service/cart.service";
import { asyncHandler } from "../utils/asyncHandler";

// User ka cart do.
export const getCart = asyncHandler(async (req: Request, res: Response) => {
  const cart = await cartService.getCart(req.user!.userId);
  res.json({ success: true, data: cart });
});

// Cart me product daalo (size/rang ke saath).
export const addToCart = asyncHandler(async (req: Request, res: Response) => {
  const { productId, quantity, size, color } = req.body;
  const cart = await cartService.addItem(req.user!.userId, productId, quantity, { size, color });
  res.json({ success: true, data: cart });
});

// Cart me quantity badlo.
export const updateCartItem = asyncHandler(async (req: Request, res: Response) => {
  const cart = await cartService.updateItem(req.user!.userId, req.params.itemId, req.body.quantity);
  res.json({ success: true, data: cart });
});

// Cart se ek line hatao.
export const removeCartItem = asyncHandler(async (req: Request, res: Response) => {
  const cart = await cartService.removeItem(req.user!.userId, req.params.itemId);
  res.json({ success: true, data: cart });
});
