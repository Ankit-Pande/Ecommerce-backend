import { Router } from 'express'
import { validate } from '../middlewares/Validation'
import { productQuerySchema, slugSchema } from '../validation/Product'
import { getProducts, getProductBySlug } from '../controllers/ProductControll'

const router = Router()

router.get('/', validate(productQuerySchema), getProducts)
router.get('/:slug', validate(slugSchema), getProductBySlug) 

export const productRoutes = router