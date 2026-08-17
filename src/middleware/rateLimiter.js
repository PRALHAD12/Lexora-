import rateLimit from "express-rate-limit";
import config from "../config/index.js";
import { ERROR_MESSAGES } from "../utils/constants.js";

/**
 * General-purpose rate limiter for all API routes.
 * Keys by authenticated user ID/token if available, otherwise by IP.
 */
export const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  keyGenerator: (req) => {
    if (req.user?.id) return `user_${req.user.id}`;
    if (req.headers.authorization) {
      return `auth_${req.headers.authorization.slice(-32)}`;
    }
    return req.ip || "unknown_ip";
  },
  message: {
    success: false,
    message: ERROR_MESSAGES.RATE_LIMITED,
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
});

/**
 * Strict rate limiter for authentication endpoints.
 * Keys by the submitted email address to prevent cross-user lockouts on shared IPs/localhost.
 */
export const authLimiter = rateLimit({
  windowMs: config.rateLimit.auth.windowMs,
  max: config.rateLimit.auth.maxRequests,
  keyGenerator: (req) => {
    const email = req.body?.email?.trim().toLowerCase();
    if (email) return `auth_email_${email}`;
    return req.ip || "unknown_ip";
  },
  message: {
    success: false,
    message: ERROR_MESSAGES.RATE_LIMITED,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

export default { generalLimiter, authLimiter };
