import { Request, Response } from "express";
import { OrderStatus } from "@prisma/client";
import { adminService } from "../service/admin.service";
import { uploadImage } from "../integration/storage";
import { asyncHandler } from "../utils/asyncHandler";

// Multer memoryStorage se buffer milta hai -> Cloudinary pe upload -> URLs.
async function imageUrls(req: Request): Promise<string[]> {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) return [];
  return Promise.all(files.map((f) => uploadImage(f.buffer)));
}
async function singleImageUrl(req: Request): Promise<string | undefined> {
  const file = req.file as Express.Multer.File | undefined;
  return file ? uploadImage(file.buffer) : undefined;
}

// ---------- Product ----------
// Images upload (max 10) -> Cloudinary URLs. Admin panel bulk se pehle isse URLs leta hai.
export const uploadImages = asyncHandler(async (req: Request, res: Response) => {
  const urls = await imageUrls(req);
  if (urls.length === 0) {
    res.status(400).json({ success: false, message: "No images provided" });
    return;
  }
  res.status(201).json({ success: true, data: urls });
});

// Bulk create — JSON array (images = Cloudinary URLs). Duplicate slug skip + report.
export const bulkCreateProducts = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await adminService.bulkCreateProducts(req.body.products);
    res.status(201).json({ success: true, data: result });
  }
);

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await adminService.createProduct(req.body, await imageUrls(req));
  res.status(201).json({ success: true, data: product });
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await adminService.updateProduct(
    req.params.id,
    req.body,
    await imageUrls(req)
  );
  res.json({ success: true, data: product });
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  await adminService.deleteProduct(req.params.id);
  res.json({ success: true, message: "Product deactivated" });
});

// Edit form ke liye single product (full fields).
export const getAdminProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await adminService.getProduct(req.params.id);
  res.json({ success: true, data: product });
});

export const listAdminProducts = asyncHandler(
  async (req: Request, res: Response) => {
    const { q, cursor, limit } = req.query as unknown as {
      q?: string;
      cursor?: string;
      limit: number;
    };
    const result = await adminService.listProducts(q, cursor, limit);
    res.json({ success: true, ...result });
  }
);

// ---------- Category ----------
export const createCategory = asyncHandler(
  async (req: Request, res: Response) => {
    const category = await adminService.createCategory(req.body, await singleImageUrl(req));
    res.status(201).json({ success: true, data: category });
  }
);

export const updateCategory = asyncHandler(
  async (req: Request, res: Response) => {
    const category = await adminService.updateCategory(
      req.params.id,
      req.body,
      await singleImageUrl(req)
    );
    res.json({ success: true, data: category });
  }
);

export const deleteCategory = asyncHandler(
  async (req: Request, res: Response) => {
    await adminService.deleteCategory(req.params.id);
    res.json({ success: true, message: "Category deleted" });
  }
);

// ---------- Brand ----------
export const createBrand = asyncHandler(async (req: Request, res: Response) => {
  const brand = await adminService.createBrand(req.body, await singleImageUrl(req));
  res.status(201).json({ success: true, data: brand });
});

export const updateBrand = asyncHandler(async (req: Request, res: Response) => {
  const brand = await adminService.updateBrand(
    req.params.id,
    req.body,
    await singleImageUrl(req)
  );
  res.json({ success: true, data: brand });
});

export const deleteBrand = asyncHandler(async (req: Request, res: Response) => {
  await adminService.deleteBrand(req.params.id);
  res.json({ success: true, message: "Brand deleted" });
});

// ---------- Banner ----------
export const createBanner = asyncHandler(async (req: Request, res: Response) => {
  const url = await singleImageUrl(req);
  if (!url) {
    res.status(400).json({ success: false, message: "Banner image required" });
    return;
  }
  const banner = await adminService.createBanner(req.body, url);
  res.status(201).json({ success: true, data: banner });
});

export const updateBanner = asyncHandler(async (req: Request, res: Response) => {
  const banner = await adminService.updateBanner(
    req.params.id,
    req.body,
    await singleImageUrl(req)
  );
  res.json({ success: true, data: banner });
});

export const deleteBanner = asyncHandler(async (req: Request, res: Response) => {
  await adminService.deleteBanner(req.params.id);
  res.json({ success: true, message: "Banner deleted" });
});

// ---------- Orders ----------
export const listAdminOrders = asyncHandler(
  async (req: Request, res: Response) => {
    const { status, cursor, limit } = req.query as unknown as {
      status?: OrderStatus;
      cursor?: string;
      limit: number;
    };
    const result = await adminService.listOrders(status, cursor, limit);
    res.json({ success: true, ...result });
  }
);

export const updateOrderStatus = asyncHandler(
  async (req: Request, res: Response) => {
    await adminService.updateOrderStatus(
      req.params.id,
      req.body.status as OrderStatus
    );
    res.json({ success: true, message: "Order updated" });
  }
);

// ---------- Users ----------
export const listAdminUsers = asyncHandler(
  async (req: Request, res: Response) => {
    const { q, cursor, limit } = req.query as unknown as {
      q?: string;
      cursor?: string;
      limit: number;
    };
    const result = await adminService.listUsers(q, cursor, limit);
    res.json({ success: true, ...result });
  }
);

export const blockUser = asyncHandler(async (req: Request, res: Response) => {
  await adminService.setUserBlock(req.params.id, req.body.isBlocked);
  res.json({ success: true, message: "User updated" });
});

export const setUserRole = asyncHandler(async (req: Request, res: Response) => {
  await adminService.setUserRole(req.params.id, req.body.role);
  res.json({ success: true, message: "User role updated" });
});
