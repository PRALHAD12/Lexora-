import rateLimit from 'express-rate-limit';
import config from '../config/index.js';
import { ERROR_MESSAGES } from '../utils/constants.js';

/**
 * General-purpose rate limiter for all API routes.
 */
export const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    message: ERROR_MESSAGES.RATE_LIMITED,
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false,  // Disable `X-RateLimit-*` headers
});

/**
 * Strict rate limiter for authentication endpoints.
 * Prevents brute-force attacks on login, registration, and password reset.
 */
export const authLimiter = rateLimit({
  windowMs: config.rateLimit.auth.windowMs,
  max: config.rateLimit.auth.maxRequests,
  message: {
    success: false,
    message: ERROR_MESSAGES.RATE_LIMITED,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

export default { generalLimiter, authLimiter };
