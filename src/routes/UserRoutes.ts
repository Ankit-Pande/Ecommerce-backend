import { Router } from 'express'
import { authCheck } from '../middlewares/Authcheck'
import { blockCheck } from '../middlewares/Blockcheck'
import { validate } from '../middlewares/Validation'
import { getProfile, updateProfile, addAddress, deleteAddress } from '../controllers/UserControll'
import { updateProfileSchema, addressSchema, addressIdSchema } from '../validation/User'

const router = Router()

// Ye middlewares har niche wale route ko protect karenge
router.use(authCheck)
router.use(blockCheck)

router.get('/profile', getProfile)
router.patch('/profile', validate(updateProfileSchema), updateProfile)
router.post('/address', validate(addressSchema), addAddress)
router.delete('/address/:id', validate(addressIdSchema), deleteAddress)

export const userRoutes = router