import redis, { isRedisConnected } from "../config/redis.js";
import logger from "./logger.js";

// In-memory fallback map if Redis server is offline
const memoryFallback = new Map();

/**
 * Get item from cache (Redis or Memory Fallback)
 * @param {string} key
 * @returns {Promise<any|null>}
 */
export const cacheGet = async (key) => {
  try {
    if (isRedisConnected()) {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    }
  } catch (error) {
    logger.warn(`Redis cache get error for key [${key}]: ${error.message}`);
  }

  // Memory fallback
  const cached = memoryFallback.get(key);
  if (cached && cached.expiry > Date.now()) {
    return cached.value;
  }
  memoryFallback.delete(key);
  return null;
};

/**
 * Set item in cache with TTL in seconds
 * @param {string} key
 * @param {any} value
 * @param {number} ttlSeconds Expiration in seconds (default: 300)
 */
export const cacheSet = async (key, value, ttlSeconds = 300) => {
  try {
    if (isRedisConnected()) {
      await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
      return;
    }
  } catch (error) {
    logger.warn(`Redis cache set error for key [${key}]: ${error.message}`);
  }

  // Memory fallback
  memoryFallback.set(key, {
    value,
    expiry: Date.now() + ttlSeconds * 1000,
  });
};

/**
 * Delete item or pattern from cache
 * @param {string} keyOrPattern
 */
export const cacheDel = async (keyOrPattern) => {
  try {
    if (isRedisConnected()) {
      if (keyOrPattern.includes("*")) {
        const keys = await redis.keys(keyOrPattern);
        if (keys.length > 0) {
          await redis.del(keys);
        }
      } else {
        await redis.del(keyOrPattern);
      }
    }
  } catch (error) {
    logger.warn(`Redis cache del error: ${error.message}`);
  }

  // Memory fallback cleanup
  for (const key of memoryFallback.keys()) {
    if (key.includes(keyOrPattern.replace("*", ""))) {
      memoryFallback.delete(key);
    }
  }
};

export default {
  cacheGet,
  cacheSet,
  cacheDel,
};
