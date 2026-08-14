import mongoose from "mongoose";
import ApiResponse from "../../utils/ApiResponse.js";
import redis, { isRedisConnected } from "../../config/redis.js";

/**
 * GET /api/v1/health
 * Returns server health status, database connection state, and uptime.
 */
export const getHealth = (_req, res) => {
  const dbStates = ["disconnected", "connected", "connecting", "disconnecting"];

  const healthData = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())}s`,
    environment: process.env.NODE_ENV || "development",
    database: {
      status: dbStates[mongoose.connection.readyState] || "unknown",
    },
    redis: {
      connected: isRedisConnected(),
    },
    memory: {
      heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
      rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
    },
  };

  return ApiResponse.ok(res, "Server is healthy", healthData);
};

/**
 * GET /api/v1/health/cache-debug
 * Inspect active Redis cache keys, stored values, and remaining TTL.
 */
export const getCacheDebug = async (_req, res) => {
  try {
    const isConnected = isRedisConnected();
    let keys = [];
    const cacheData = {};

    if (isConnected) {
      keys = await redis.keys("*");
      for (const key of keys) {
        const val = await redis.get(key);
        const ttl = await redis.ttl(key);
        try {
          cacheData[key] = { ttl: `${ttl}s`, value: JSON.parse(val) };
        } catch {
          cacheData[key] = { ttl: `${ttl}s`, value: val };
        }
      }
    }

    return ApiResponse.ok(res, "Active Redis cache inspection", {
      redisConnected: isConnected,
      totalKeys: keys.length,
      keys,
      cacheData,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

export default { getHealth, getCacheDebug };
