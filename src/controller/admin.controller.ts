import { Request, Response } from "express";
import { OrderStatus } from "@prisma/client";
import { adminService } from "../service/admin.service";
import { orderService } from "../service/order.service";
import { reviewService } from "../service/review.service";
import { uploadFiles, uploadImage } from "../integration/storage";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/appError";

type ListQuery = { cursor?: string; limit: number };

// Images upload karke URLs do (bulk product ke liye).
export const uploadImages = asyncHandler(async (req: Request, res: Response) => {
  const urls = await uploadFiles(req.files as Express.Multer.File[]);
  if (urls.length === 0) throw new AppError("No images provided", 400);
  res.status(201).json({ success: true, data: urls });
});

// Admin ke liye products ki list (search ke saath).
export const listAdminProducts = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListQuery & { q?: string };
  const result = await adminService.listProducts(query);
  res.json({ success: true, ...result });
});

// Edit form ke liye ek product.
export const getAdminProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await adminService.getProduct(req.params.id);
  res.json({ success: true, data: product });
});

// Pehle slug check, phir upload — galat request ki image upload na ho.
export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  await adminService.checkSlugFree(req.body.slug);
  const images = await uploadFiles(req.files as Express.Multer.File[]);
  const product = await adminService.createProduct(req.body, images);
  res.status(201).json({ success: true, data: product });
});

// Ek saath bahut saare products jodo.
export const bulkCreateProducts = asyncHandler(async (req: Request, res: Response) => {
  const result = await adminService.bulkCreateProducts(req.body.products);
  res.status(201).json({ success: true, data: result });
});

// Product badlo; nayi images aayi to upload karke lagao.
export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  await adminService.checkProductExists(req.params.id);
  const images = await uploadFiles(req.files as Express.Multer.File[]);
  const product = await adminService.updateProduct(req.params.id, req.body, images);
  res.json({ success: true, data: product });
});

// Sale lagao ya hatao.
export const applySale = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await adminService.applySale(req.body) });
});

// Product chhupao (delete nahi hota, purane orders me chahiye).
export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  await adminService.hideProduct(req.params.id);
  res.json({ success: true, message: "Product deactivated" });
});

// Saari category aur subcategory.
export const listAdminCategories = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await adminService.listCategories() });
});

// Nayi category (image ho to upload karke).
export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const image = req.file ? await uploadImage(req.file.buffer) : undefined;
  const category = await adminService.createCategory(req.body, image);
  res.status(201).json({ success: true, data: category });
});

// Category badlo.
export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const image = req.file ? await uploadImage(req.file.buffer) : undefined;
  const category = await adminService.updateCategory(req.params.id, req.body, image);
  res.json({ success: true, data: category });
});

// Category hatao.
export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  await adminService.deleteCategory(req.params.id);
  res.json({ success: true, message: "Category deleted" });
});

// Saare brand.
export const listAdminBrands = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await adminService.listBrands() });
});

// Naya brand (logo ho to upload karke).
export const createBrand = asyncHandler(async (req: Request, res: Response) => {
  const logo = req.file ? await uploadImage(req.file.buffer) : undefined;
  const brand = await adminService.createBrand(req.body, logo);
  res.status(201).json({ success: true, data: brand });
});

// Brand badlo ya chhupao.
export const updateBrand = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await adminService.updateBrand(req.params.id, req.body) });
});

// Brand hatao.
export const deleteBrand = asyncHandler(async (req: Request, res: Response) => {
  await adminService.deleteBrand(req.params.id);
  res.json({ success: true, message: "Brand deleted" });
});

// Saare banner.
export const listAdminBanners = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await adminService.listBanners() });
});

// Naya banner (image zaroori).
export const createBanner = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new AppError("Banner image required", 400);
  const image = await uploadImage(req.file.buffer);
  const banner = await adminService.createBanner(req.body, image);
  res.status(201).json({ success: true, data: banner });
});

// Banner badlo ya chhupao.
export const updateBanner = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await adminService.updateBanner(req.params.id, req.body) });
});

// Banner hatao.
export const deleteBanner = asyncHandler(async (req: Request, res: Response) => {
  await adminService.deleteBanner(req.params.id);
  res.json({ success: true, message: "Banner deleted" });
});

// Dashboard ke number.
export const getAdminStats = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await adminService.getStats() });
});

// Saare orders (filter ke saath).
export const listAdminOrders = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListQuery & { status?: OrderStatus; needsReview?: boolean };
  const result = await adminService.listOrders(query);
  res.json({ success: true, ...result });
});

// Order ka status badlo (ship, deliver ya cancel).
export const updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  await orderService.updateStatus(req.params.id, req.body.status);
  res.json({ success: true, message: "Order updated" });
});

// Admin ne Razorpay se paisa lauta diya — order ka review band.
export const markOrderRefunded = asyncHandler(async (req: Request, res: Response) => {
  await orderService.markRefunded(req.params.id);
  res.json({ success: true, message: "Refund recorded" });
});

// Saare users (phone se search).
export const listAdminUsers = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListQuery & { q?: string };
  const result = await adminService.listUsers(query);
  res.json({ success: true, ...result });
});

// User ko block ya unblock karo.
export const blockUser = asyncHandler(async (req: Request, res: Response) => {
  await adminService.setUserBlock(req.user!, req.params.id, req.body.isBlocked);
  res.json({ success: true, message: "User updated" });
});

// User ko admin banao ya hatao.
export const setUserRole = asyncHandler(async (req: Request, res: Response) => {
  await adminService.setUserRole(req.user!, req.params.id, req.body.role);
  res.json({ success: true, message: "User role updated" });
});

// Galat review hatao.
export const deleteReview = asyncHandler(async (req: Request, res: Response) => {
  await reviewService.removeByAdmin(req.params.id);
  res.json({ success: true, message: "Review deleted" });
});
