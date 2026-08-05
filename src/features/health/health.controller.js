import mongoose from 'mongoose';
import ApiResponse from '../../utils/ApiResponse.js';

/**
 * GET /api/v1/health
 * Returns server health status, database connection state, and uptime.
 */
export const getHealth = (_req, res) => {
  const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];

  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())}s`,
    environment: process.env.NODE_ENV || 'development',
    database: {
      status: dbStates[mongoose.connection.readyState] || 'unknown',
    },
    memory: {
      heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
      rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
    },
  };

  return ApiResponse.ok(res, 'Server is healthy', healthData);
};

export default { getHealth };
