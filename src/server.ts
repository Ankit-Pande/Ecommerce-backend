import { app } from './app'
import { env } from './config/env'
import { connectDB, disconnectDB } from './config/db'
import { redis, disconnectRedis } from './config/redis'
import { logger } from './config/winston'
import { Socket } from 'net'

async function startServer() {
  try {
    // 1. Database aur Redis connect karo
    await connectDB()
    await redis.ping()
    
    // 2. Server start karo
    const server = app.listen(env.PORT, () => {
      logger.info(`🚀 Server running on port ${env.PORT} in ${env.NODE_ENV} mode`)
    })

    // 3. Active connections track karo (taaki emergency me close kar sakein)
    const connections = new Set<Socket>()
    server.on('connection', (connection) => {
      connections.add(connection)
      connection.on('close', () => connections.delete(connection))
    })

    // 4. Graceful Shutdown function
    const shutdown = async (signal: string) => {
      logger.info(`\n Received ${signal}. Shutting down server gracefully...`)
      
      // Naye requests aana band honge, par purane aaram se poore honge
      server.close(async () => {
        try {
          await disconnectDB()
          await disconnectRedis() // Safe disconnect, quit nahi
          logger.info('✅ All connections closed successfully.')
          process.exit(0)
        } catch (err) {
          logger.error('❌ Error during disconnect', { err })
          process.exit(1)
        }
      })

      // Agar 10 second me process normal close nahi hua, tab force kill karo
      setTimeout(() => {
        logger.error('❌ Force shutdown after 10 seconds timeout. Destroying active sockets...')
        // Ab hum harsh ho rahe hain kyunki time khatam ho gaya
        for (const connection of connections) {
          connection.destroy()
        }
        process.exit(1)
      }, 10000)
    }

    // 5. System signals (CTRL+C ya hosting se aane wale signals)
    process.on('SIGINT', () => shutdown('SIGINT'))
    process.on('SIGTERM', () => shutdown('SIGTERM'))

    // 6. Errors jo handle nahi huye, unpar app safely band ho
    process.on('unhandledRejection', (err) => {
      logger.error('Unhandled Rejection', { err })
      shutdown('unhandledRejection')
    })

    process.on('uncaughtException', (err) => {
      logger.error('🚨 Uncaught Exception', { err })
      shutdown('uncaughtException')
    })

  } catch (error) {
    logger.error('❌ Server startup failed', { error })
    process.exit(1)
  }
}

startServer()