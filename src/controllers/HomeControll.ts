import { Request, Response } from "express"
import { asyncHandler } from "../utils/AsyncHandler"
import { homeService } from "../services/HomeService"
import { AppError } from "../utils/AppError"

//
// 1️⃣ Home Page
//
export const getHomePage = asyncHandler(
  async (_req: Request, res: Response) => {

    const data = await homeService.getHomeData()

    res.json({
      success: true,
      data,
    })
  }
)


//
// 2️⃣ Category Products (Slug Fix Applied)
//
export const getCategoryProducts = asyncHandler(
  async (req: Request, res: Response) => {

    const slug = req.params.slug

    // ✅ FIX: slug type safe check
    if (!slug || Array.isArray(slug)) {
      throw new AppError("Invalid slug", 400)
    }

    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || 10

    const data = await homeService.getCategoryProducts(
      slug,
      page,
      limit
    )

    if (!data) {
      throw new AppError("Category not found", 404)
    }

    res.json({
      success: true,
      ...data,
    })
  }
)


//
// 3️⃣ Similar Products (Query Fix Applied)
//
export const getSimilar = asyncHandler(
  async (req: Request, res: Response) => {

    const productIdRaw = req.query.productId
    const categoryIdRaw = req.query.categoryId

    if (
      typeof productIdRaw !== "string" ||
      typeof categoryIdRaw !== "string"
    ) {
      throw new AppError("Missing or invalid IDs", 400)
    }

    const products = await homeService.getSimilarProducts(
      productIdRaw,
      categoryIdRaw
    )

    res.json({
      success: true,
      products,
    })
  }
)


//
// 4️⃣ Track Recently Viewed
//
export const trackView = asyncHandler(
  async (req: Request, res: Response) => {

    if (req.user) {
      await homeService.trackRecentlyViewed(
        req.user.userId,
        req.body.productId
      )
    }

    res.json({ success: true })
  }
)


//
// 5️⃣ Get Recently Viewed
//
export const getRecentlyViewed = asyncHandler(
  async (req: Request, res: Response) => {

    if (!req.user) {
      throw new AppError("Unauthorized", 401)
    }

    const products =
      await homeService.getRecentlyViewed(req.user.userId)

    res.json({
      success: true,
      products,
    })
  }
)