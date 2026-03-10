import twilio from 'twilio'
import { env } from '../config/env'
import { AppError } from '../utils/AppError'
import { logger } from '../config/winston'

const isProd = env.NODE_ENV === 'production'

// Twilio client sirf production mein chalega
const client = isProd
  ? twilio(env.TWILIO_ACCOUNT_SID!, env.TWILIO_AUTH_TOKEN!)
  : null

export const sendSms = async (to: string, message: string): Promise<void> => {
  // Development mode: SMS bhejne ke bajay sirf terminal mein dikhayein
  if (!isProd) {
    logger.info(`📩 DEV SMS → ${to}: ${message}`)
    return
  }

  // Production mein client setup check karein
  if (!client) {
    throw new AppError('SMS service is not configured properly', 500)
  }

  try {
    // Asli SMS bhejein
    await client.messages.create({
      to,
      from: env.TWILIO_PHONE_NUMBER!,
      body: message,
    })

    logger.info(`✅ SMS sent successfully to ${to}`)
  } catch (error) {
    // Error aane par safely log karein aur API fail karein
    logger.error('❌ Twilio error', {
      error: error instanceof Error ? error.message : error,
    })

    throw new AppError('Failed to send SMS', 503)
  }
}