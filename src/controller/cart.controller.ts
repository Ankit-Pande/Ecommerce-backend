import { Request, Response } from "express";
import { cartService } from "../service/cart.service";
import { asyncHandler } from "../utils/asyncHandler";

// GET /cart — the user's cart with live prices and stock.
export const getCart = asyncHandler(async (req: Request, res: Response) => {
  const cart = await cartService.getCart(req.user!.userId);
  res.json({ success: true, data: cart });
});

// POST /cart — adds a product (with size and colour) to the cart.
export const addToCart = asyncHandler(async (req: Request, res: Response) => {
  const { productId, quantity, size, color } = req.body;
  const cart = await cartService.addItem(req.user!.userId, productId, quantity, { size, color });
  res.json({ success: true, data: cart });
});

// PATCH /cart/:id — changes the quantity of a cart line.
export const updateCartItem = asyncHandler(async (req: Request, res: Response) => {
  const cart = await cartService.updateItem(req.user!.userId, req.params.id, req.body.quantity);
  res.json({ success: true, data: cart });
});

// DELETE /cart/:id — removes a cart line.
export const removeCartItem = asyncHandler(async (req: Request, res: Response) => {
  const cart = await cartService.removeItem(req.user!.userId, req.params.id);
  res.json({ success: true, data: cart });
});
