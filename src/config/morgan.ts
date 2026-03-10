import morgan from 'morgan'
import { logger } from './winston'

export const requestLogger = morgan('dev', {
  skip: (req) => req.url === '/health',
  stream: {
    write: (message: string) => {
      logger.info(message.trim())
    },
  },
})