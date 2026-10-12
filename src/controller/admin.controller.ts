import { Request, Response } from "express";
import { OrderStatus } from "@prisma/client";
import { uploadFiles, uploadImage } from "../integration/storage";
import { adminService } from "../service/admin.service";
import { orderService } from "../service/order.service";
import { reviewService } from "../service/review.service";
import { AppError } from "../utils/appError";
import { asyncHandler } from "../utils/asyncHandler";

type ListQuery = { cursor?: string; limit: number };

export const uploadImages = asyncHandler(async (req: Request, res: Response) => {
  const urls = await uploadFiles(req.files as Express.Multer.File[]);
  if (urls.length === 0) throw new AppError("No images provided", 400);
  res.status(201).json({ success: true, data: urls });
});

export const listAdminProducts = asyncHandler(async (req: Request, res: Response) => {
  const result = await adminService.listProducts(req.query as unknown as ListQuery & { q?: string });
  res.json({ success: true, ...result });
});

export const getAdminProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await adminService.getProduct(req.params.id);
  res.json({ success: true, data: product });
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  await adminService.checkSlugFree(req.body.slug);
  const images = await uploadFiles(req.files as Express.Multer.File[]);
  const product = await adminService.createProduct(req.body, images);
  res.status(201).json({ success: true, data: product });
});

export const bulkCreateProducts = asyncHandler(async (req: Request, res: Response) => {
  const result = await adminService.bulkCreateProducts(req.body.products);
  res.status(201).json({ success: true, data: result });
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  await adminService.checkProductExists(req.params.id);
  const images = await uploadFiles(req.files as Express.Multer.File[]);
  const product = await adminService.updateProduct(req.params.id, req.body, images);
  res.json({ success: true, data: product });
});

export const applySale = asyncHandler(async (req: Request, res: Response) => {
  const result = await adminService.applySale(req.body);
  res.json({ success: true, data: result });
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  await adminService.hideProduct(req.params.id);
  res.json({ success: true, message: "Product deactivated" });
});

export const listAdminCategories = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await adminService.listCategories();
  res.json({ success: true, data: categories });
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const image = req.file ? await uploadImage(req.file.buffer) : undefined;
  const category = await adminService.createCategory(req.body, image);
  res.status(201).json({ success: true, data: category });
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const image = req.file ? await uploadImage(req.file.buffer) : undefined;
  const category = await adminService.updateCategory(req.params.id, req.body, image);
  res.json({ success: true, data: category });
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  await adminService.deleteCategory(req.params.id);
  res.json({ success: true, message: "Category deleted" });
});

export const listAdminBrands = asyncHandler(async (_req: Request, res: Response) => {
  const brands = await adminService.listBrands();
  res.json({ success: true, data: brands });
});

export const createBrand = asyncHandler(async (req: Request, res: Response) => {
  const logo = req.file ? await uploadImage(req.file.buffer) : undefined;
  const brand = await adminService.createBrand(req.body, logo);
  res.status(201).json({ success: true, data: brand });
});

export const updateBrand = asyncHandler(async (req: Request, res: Response) => {
  const brand = await adminService.updateBrand(req.params.id, req.body);
  res.json({ success: true, data: brand });
});

export const deleteBrand = asyncHandler(async (req: Request, res: Response) => {
  await adminService.deleteBrand(req.params.id);
  res.json({ success: true, message: "Brand deleted" });
});

export const listAdminBanners = asyncHandler(async (_req: Request, res: Response) => {
  const banners = await adminService.listBanners();
  res.json({ success: true, data: banners });
});

export const createBanner = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new AppError("Banner image required", 400);
  const image = await uploadImage(req.file.buffer);
  const banner = await adminService.createBanner(req.body, image);
  res.status(201).json({ success: true, data: banner });
});

export const updateBanner = asyncHandler(async (req: Request, res: Response) => {
  const banner = await adminService.updateBanner(req.params.id, req.body);
  res.json({ success: true, data: banner });
});

export const deleteBanner = asyncHandler(async (req: Request, res: Response) => {
  await adminService.deleteBanner(req.params.id);
  res.json({ success: true, message: "Banner deleted" });
});

export const getAdminStats = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await adminService.getStats();
  res.json({ success: true, data: stats });
});

export const listAdminOrders = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListQuery & { status?: OrderStatus; needsReview?: boolean };
  const result = await adminService.listOrders(query);
  res.json({ success: true, ...result });
});

export const updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  await orderService.updateStatus(req.params.id, req.body.status);
  res.json({ success: true, message: "Order updated" });
});

export const markOrderRefunded = asyncHandler(async (req: Request, res: Response) => {
  await orderService.markRefunded(req.params.id);
  res.json({ success: true, message: "Refund recorded" });
});

export const listAdminUsers = asyncHandler(async (req: Request, res: Response) => {
  const result = await adminService.listUsers(req.query as unknown as ListQuery & { q?: string });
  res.json({ success: true, ...result });
});

export const blockUser = asyncHandler(async (req: Request, res: Response) => {
  await adminService.setUserBlock(req.user!, req.params.id, req.body.isBlocked);
  res.json({ success: true, message: "User updated" });
});

export const setUserRole = asyncHandler(async (req: Request, res: Response) => {
  await adminService.setUserRole(req.user!, req.params.id, req.body.role);
  res.json({ success: true, message: "User role updated" });
});

export const deleteReview = asyncHandler(async (req: Request, res: Response) => {
  await reviewService.removeByAdmin(req.params.id);
  res.json({ success: true, message: "Review deleted" });
});
