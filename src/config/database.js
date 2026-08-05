import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import config from './index.js';

/**
 * Connect to MongoDB with retry logic and event logging.
 */
export async function connectDatabase() {
  const options = {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  };

  try {
    await mongoose.connect(config.db.uri, options);
    logger.info(`MongoDB connected: ${mongoose.connection.host}`);
  } catch (error) {
    logger.error('MongoDB connection failed:', error);
    process.exit(1);
  }

  // Connection event handlers
  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected');
  });
}

/**
 * Gracefully disconnect from MongoDB.
 */
export async function disconnectDatabase() {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected gracefully');
  } catch (error) {
    logger.error('Error disconnecting MongoDB:', error);
  }
}

export default { connectDatabase, disconnectDatabase };
