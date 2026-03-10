import crypto from 'crypto'

export const generateOtp = (length = 6): string => {
  const min = 10 ** (length - 1)  // 100000
  const max = 10 ** length        // 1000000 (randomInt max ko include nahi karta, toh 999999 tak banega)
  
  return crypto.randomInt(min, max).toString()
}

export const hashOtp = (otp: string): string => {
  return crypto.createHash('sha256').update(otp).digest('hex')
}