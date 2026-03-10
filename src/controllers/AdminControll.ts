import { Request, Response } from "express"
import { asyncHandler } from "../utils/AsyncHandler"
import { adminService } from "../services/AdminService"
import { AppError } from "../utils/AppError"

// 1️⃣ Create Category
export const createCategory = asyncHandler(
  async (req: Request, res: Response) => {

    const category = await adminService.createCategory(req.body)

    res.status(201).json({
      success: true,
      category,
    })
  }
)


// 2️⃣ Create Product
export const createProduct = asyncHandler(
  async (req: Request, res: Response) => {

    const product = await adminService.createProduct(req.body)

    res.status(201).json({
      success: true,
      product,
    })
  }
)


// 3️⃣ Get Products (Pagination)
export const getProducts = asyncHandler(
  async (req: Request, res: Response) => {

    const { page, limit } = req.query as {
      page: string
      limit: string
    }

    const pageNumber = Number(page) || 1
    const limitNumber = Number(limit) || 10

    const data = await adminService.getProducts(
      pageNumber,
      limitNumber
    )

    res.json({
      success: true,
      ...data,
    })
  }
)


// 4️⃣ Update Stock
export const updateStock = asyncHandler(
  async (req: Request, res: Response) => {

    const { id } = req.params as { id: string }
    const { stock } = req.body as { stock: number }

    const product = await adminService.updateStock(id, stock)

    res.json({
      success: true,
      product,
    })
  }
)


// 5️⃣ Hide Product
export const hideProduct = asyncHandler(
  async (req: Request, res: Response) => {

    const { id } = req.params as { id: string }

    const product = await adminService.hideProduct(id)

    res.json({
      success: true,
      product,
    })
  }
)


// 6️⃣ Update Offers (Trending + Discount)
export const updateOffers = asyncHandler(
  async (req: Request, res: Response) => {

    const { id } = req.params as { id: string }

    const product = await adminService.updateProductOffers(
      id,
      req.body
    )

    res.json({
      success: true,
      message: "Product offers updated",
      product,
    })
  }
)


// 7️⃣ Create Banner
export const createBanner = asyncHandler(
  async (req: Request, res: Response) => {

    const banner = await adminService.createBanner(req.body)

    res.status(201).json({
      success: true,
      banner,
    })
  }
)


// 8️⃣ Delete Banner
export const deleteBanner = asyncHandler(
  async (req: Request, res: Response) => {

    const { id } = req.params as { id: string }

    await adminService.deleteBanner(id)

    res.json({
      success: true,
      message: "Banner deleted",
    })
  }
)