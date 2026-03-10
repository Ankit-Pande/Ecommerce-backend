import { Router } from 'express'
import { authCheck } from '../middlewares/Authcheck'
import { blockCheck } from '../middlewares/Blockcheck'
import { validate } from '../middlewares/Validation'
import { addToCartSchema, updateCartItemSchema, removeCartItemSchema } from '../validation/Cart'
import { getCart, addItemToCart, updateItemQuantity, removeItemFromCart } from '../controllers/CartControll'

const router = Router()

router.use(authCheck)
router.use(blockCheck)

router.get('/', getCart)
router.post('/items', validate(addToCartSchema), addItemToCart)
router.patch('/items/:id', validate(updateCartItemSchema), updateItemQuantity)
router.delete('/items/:id', validate(removeCartItemSchema), removeItemFromCart)

export const cartRoutes = router