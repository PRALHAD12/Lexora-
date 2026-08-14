import Redis from "ioredis";
import logger from "../utils/logger.js";

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

let isConnected = false;

const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    return Math.min(times * 200, 2000);
  },
});

redis.on("ready", () => {
  isConnected = true;
  logger.info("Connected to Redis successfully");
});

redis.on("connect", () => {
  isConnected = true;
});

redis.on("error", (err) => {
  if (isConnected) {
    logger.warn(`Redis connection error: ${err.message}`);
  }
  isConnected = false;
});

export const isRedisConnected = () => isConnected;

export default redis;
