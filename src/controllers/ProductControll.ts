import { Request, Response } from 'express'
import { asyncHandler } from '../utils/AsyncHandler'
import { productService } from '../services/ProductService'
import { ProductQuery } from '../validation/Product'
import { AppError } from '../utils/AppError'

export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ProductQuery
  const result = await productService.getAllProducts(query)
  
  res.json({ success: true, ...result })
})

export const getProductBySlug = asyncHandler(async (req: Request, res: Response) => {
  const slug = req.params.slug as string 
  const product = await productService.getProductBySlug(slug)
  
  if (!product) throw new AppError('Product not found', 404)
    
  res.json({ success: true, product })
})