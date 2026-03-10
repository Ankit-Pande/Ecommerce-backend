import { sendSms } from '../integration/twilio'
import { AppError } from '../utils/AppError'

// Phone number check karne ka formula (Example: +919876543210)
const phoneRegex = /^\+[1-9]\d{7,14}$/

export const smsService = {
  async sendOtp(phone: string, otp: string) {
    // Number ke aage-peeche ka space hatayein
    const cleanPhone = phone.trim()

    // Check karein ki number sahi format mein hai ya nahi
    if (!phoneRegex.test(cleanPhone)) {
      throw new AppError('Invalid phone number format. Use country code (e.g., +91)', 400)
    }

    // Message banayein
    const message = `Your OTP is ${otp}. Valid for 2 minutes.`

    // Twilio function ko call karein
    await sendSms(cleanPhone, message)
  },
}