import app from "./app.js";
import config, { validateConfig } from "./config/index.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import logger from "./utils/logger.js";

/**
 * Bootstrap the application:
 * 1. Validate configuration
 * 2. Connect to database
 * 3. Start HTTP server
 * 4. Register graceful shutdown handlers
 */
async function startServer() {
  try {
    // 1. Validate required config
    validateConfig();
    logger.info(`Environment: ${config.app.env}`);

    // 2. Connect to MongoDB
    await connectDatabase();

    // 3. Start Express server
    const server = app.listen(config.app.port, () => {
      logger.info(`🚀 Lexora API server running on port ${config.app.port}`);
      logger.info(
        `   Health check: http://localhost:${config.app.port}/api/v1/health`,
      );
    });

    // 4. Graceful shutdown
    const gracefulShutdown = async (signal) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);

      server.close(async () => {
        logger.info("HTTP server closed");

        await disconnectDatabase();

        logger.info("Graceful shutdown complete");
        process.exit(0);
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error("Forced shutdown after timeout");
        process.exit(1);
      }, 30000);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    // Handle unhandled rejections
    process.on("unhandledRejection", (reason) => {
      logger.error("Unhandled Rejection:", reason);
      // Don't exit — let the error handler deal with it
    });

    // Handle uncaught exceptions
    process.on("uncaughtException", (error) => {
      logger.error("Uncaught Exception:", error);
      process.exit(1);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
