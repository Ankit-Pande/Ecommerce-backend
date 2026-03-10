import { Router } from 'express'
import { validate } from '../middlewares/Validation'
import { sendOtpSchema, verifyOtpSchema } from '../validation/Auth'
import { sendOtp, verifyOtp, refreshTokens, logout } from '../controllers/AuthControll'

const router = Router()

router.post('/send-otp', validate(sendOtpSchema), sendOtp)
router.post('/verify-otp', validate(verifyOtpSchema), verifyOtp)

router.post('/refresh', refreshTokens)
router.post('/logout', logout)

export const authRoutes = router