import { Request, Response } from "express";
import { OrderStatus } from "@prisma/client";
import { uploadFiles, uploadImage } from "../integration/storage";
import { adminService } from "../service/admin.service";
import { orderService } from "../service/order.service";
import { reviewService } from "../service/review.service";
import { AppError } from "../utils/appError";
import { asyncHandler } from "../utils/asyncHandler";

type ListQuery = { cursor?: string; limit: number };

// POST /admin/uploads — uploads up to 10 images and returns their URLs.
export const uploadImages = asyncHandler(async (req: Request, res: Response) => {
  const urls = await uploadFiles(req.files as Express.Multer.File[]);
  if (urls.length === 0) throw new AppError("No images provided", 400);
  res.status(201).json({ success: true, data: urls });
});

// GET /admin/products — every product (active or hidden), newest first, with stock held by unpaid orders.
export const listAdminProducts = asyncHandler(async (req: Request, res: Response) => {
  const result = await adminService.listProducts(req.query as unknown as ListQuery & { q?: string });
  res.json({ success: true, ...result });
});

// GET /admin/products/:id — one product with all fields for the edit form.
export const getAdminProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await adminService.getProduct(req.params.id);
  res.json({ success: true, data: product });
});

// POST /admin/products — creates a product with its uploaded images.
export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  await adminService.checkSlugFree(req.body.slug);
  const images = await uploadFiles(req.files as Express.Multer.File[]);
  const product = await adminService.createProduct(req.body, images);
  res.status(201).json({ success: true, data: product });
});

// POST /admin/products/bulk — creates up to 50 products from JSON (image URLs given); existing slugs are skipped.
export const bulkCreateProducts = asyncHandler(async (req: Request, res: Response) => {
  const result = await adminService.bulkCreateProducts(req.body.products);
  res.status(201).json({ success: true, data: result });
});

// PATCH /admin/products/:id — changes a product; new images replace the old ones.
export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  await adminService.checkProductExists(req.params.id);
  const images = await uploadFiles(req.files as Express.Multer.File[]);
  const product = await adminService.updateProduct(req.params.id, req.body, images);
  res.json({ success: true, data: product });
});

// POST /admin/products/sale — sets one discount on all products, or on one category.
export const applySale = asyncHandler(async (req: Request, res: Response) => {
  const result = await adminService.applySale(req.body);
  res.json({ success: true, data: result });
});

// DELETE /admin/products/:id — hides the product (old orders still point to it).
export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  await adminService.hideProduct(req.params.id);
  res.json({ success: true, message: "Product deactivated" });
});

// GET /admin/categories — all categories with their subcategories, hidden ones too.
export const listAdminCategories = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await adminService.listCategories();
  res.json({ success: true, data: categories });
});

// POST /admin/categories — creates a category or subcategory with an optional image.
export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const image = req.file ? await uploadImage(req.file.buffer) : undefined;
  const category = await adminService.createCategory(req.body, image);
  res.status(201).json({ success: true, data: category });
});

// PATCH /admin/categories/:id — changes a category.
export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const image = req.file ? await uploadImage(req.file.buffer) : undefined;
  const category = await adminService.updateCategory(req.params.id, req.body, image);
  res.json({ success: true, data: category });
});

// DELETE /admin/categories/:id — deletes an empty category.
export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  await adminService.deleteCategory(req.params.id);
  res.json({ success: true, message: "Category deleted" });
});

// GET /admin/brands — all brands.
export const listAdminBrands = asyncHandler(async (_req: Request, res: Response) => {
  const brands = await adminService.listBrands();
  res.json({ success: true, data: brands });
});

// POST /admin/brands — creates a brand with an optional logo.
export const createBrand = asyncHandler(async (req: Request, res: Response) => {
  const logo = req.file ? await uploadImage(req.file.buffer) : undefined;
  const brand = await adminService.createBrand(req.body, logo);
  res.status(201).json({ success: true, data: brand });
});

// PATCH /admin/brands/:id — renames, hides or shows a brand.
export const updateBrand = asyncHandler(async (req: Request, res: Response) => {
  const brand = await adminService.updateBrand(req.params.id, req.body);
  res.json({ success: true, data: brand });
});

// DELETE /admin/brands/:id — deletes a brand that has no products.
export const deleteBrand = asyncHandler(async (req: Request, res: Response) => {
  await adminService.deleteBrand(req.params.id);
  res.json({ success: true, message: "Brand deleted" });
});

// GET /admin/banners — all home page banners.
export const listAdminBanners = asyncHandler(async (_req: Request, res: Response) => {
  const banners = await adminService.listBanners();
  res.json({ success: true, data: banners });
});

// POST /admin/banners — creates a banner (image required).
export const createBanner = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new AppError("Banner image required", 400);
  const image = await uploadImage(req.file.buffer);
  const banner = await adminService.createBanner(req.body, image);
  res.status(201).json({ success: true, data: banner });
});

// PATCH /admin/banners/:id — changes a banner's link, position or visibility.
export const updateBanner = asyncHandler(async (req: Request, res: Response) => {
  const banner = await adminService.updateBanner(req.params.id, req.body);
  res.json({ success: true, data: banner });
});

// DELETE /admin/banners/:id — deletes a banner.
export const deleteBanner = asyncHandler(async (req: Request, res: Response) => {
  await adminService.deleteBanner(req.params.id);
  res.json({ success: true, message: "Banner deleted" });
});

// GET /admin/stats — today's orders and revenue, and the orders waiting for work.
export const getAdminStats = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await adminService.getStats();
  res.json({ success: true, data: stats });
});

// GET /admin/orders — all orders, newest first, filtered by status or "needs review".
export const listAdminOrders = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListQuery & { status?: OrderStatus; needsReview?: boolean };
  const result = await adminService.listOrders(query);
  res.json({ success: true, ...result });
});

// PATCH /admin/orders/:id/status — ships, delivers or cancels an order.
export const updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  await orderService.updateStatus(req.params.id, req.body.status);
  res.json({ success: true, message: "Order updated" });
});

// PATCH /admin/orders/:id/refunded — records that a payment under review was refunded.
export const markOrderRefunded = asyncHandler(async (req: Request, res: Response) => {
  await orderService.markRefunded(req.params.id);
  res.json({ success: true, message: "Refund recorded" });
});

// GET /admin/users — customers, newest first, searchable by phone.
export const listAdminUsers = asyncHandler(async (req: Request, res: Response) => {
  const result = await adminService.listUsers(req.query as unknown as ListQuery & { q?: string });
  res.json({ success: true, ...result });
});

// PATCH /admin/users/:id/block — blocks or unblocks a user.
export const blockUser = asyncHandler(async (req: Request, res: Response) => {
  await adminService.setUserBlock(req.user!, req.params.id, req.body.isBlocked);
  res.json({ success: true, message: "User updated" });
});

// PATCH /admin/users/:id/role — makes a user an admin or back to a normal user (super admin only).
export const setUserRole = asyncHandler(async (req: Request, res: Response) => {
  await adminService.setUserRole(req.user!, req.params.id, req.body.role);
  res.json({ success: true, message: "User role updated" });
});

// DELETE /admin/reviews/:id — deletes a review and fixes the product rating.
export const deleteReview = asyncHandler(async (req: Request, res: Response) => {
  await reviewService.removeByAdmin(req.params.id);
  res.json({ success: true, message: "Review deleted" });
});
