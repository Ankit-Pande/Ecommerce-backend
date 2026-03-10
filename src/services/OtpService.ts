import { redis } from '../config/redis'
import { AppError } from '../utils/AppError'
import crypto from 'crypto'
import { smsService } from './SmsService'
import { generateOtp, hashOtp } from '../utils/Otp'

const OTP_TTL = 120 
const MAX_SEND = 3
const MAX_VERIFY = 5
const BLOCK_TTL = 3600 

const otpKey = (p: string) => `otp:${p}`
const sendKey = (p: string) => `otp:send:${p}`
const verifyKey = (p: string) => `otp:verify:${p}`
const blockKey = (p: string) => `otp:block:${p}`

export const otpService = {
  async sendOtp(phone: string) {
    const p = phone.trim()

    // 1. Check karein user block toh nahi hai
    if (await redis.get(blockKey(p))) {
      throw new AppError('Blocked for 1 hour due to too many attempts', 429)
    }

    // 2. Check karein OTP bhejne ki limit cross toh nahi hui
    const sendCount = Number(await redis.get(sendKey(p))) || 0
    if (sendCount >= MAX_SEND) {
      await redis.set(blockKey(p), '1', 'EX', BLOCK_TTL)
      throw new AppError('Too many attempts. Blocked for 1 hour.', 429)
    }

    const otp = generateOtp()
    const hashed = hashOtp(otp)

    // 3. Asli SMS bhejein
    await smsService.sendOtp(p, otp)

    // 4. Redis mein save karein (Pipeline se fast hota hai)
    const pipe = redis.pipeline()
    pipe.set(otpKey(p), hashed, 'EX', OTP_TTL)
    pipe.incr(sendKey(p))
    pipe.expire(sendKey(p), BLOCK_TTL)
    await pipe.exec()
  },

async verifyOtp(phone: string, otp: string) {
    const p = phone.trim()

    if (await redis.get(blockKey(p))) {
      throw new AppError('Blocked for 1 hour', 429)
    }

    const stored = await redis.get(otpKey(p))
    if (!stored) {
      throw new AppError('OTP expired or not requested', 400)
    }

    // IMPROVED: Timing-Safe Equal use kiya hai
    const hashedInputBuffer = Buffer.from(hashOtp(otp), 'utf8')
    const storedBuffer = Buffer.from(stored, 'utf8')

    // Agar length alag hai ya OTP match nahi kiya
    if (hashedInputBuffer.length !== storedBuffer.length || !crypto.timingSafeEqual(hashedInputBuffer, storedBuffer)) {
      const attempts = Number(await redis.incr(verifyKey(p)))
      await redis.expire(verifyKey(p), OTP_TTL)

      if (attempts >= MAX_VERIFY) {
        await redis.set(blockKey(p), '1', 'EX', BLOCK_TTL)
      }
      throw new AppError('Invalid OTP', 400)
    }

    // Sahi hone par saara OTP data Redis se mita dein
    await redis.del(otpKey(p), sendKey(p), verifyKey(p), blockKey(p))
}
}