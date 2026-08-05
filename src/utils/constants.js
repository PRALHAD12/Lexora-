/**
 * Application-wide constants.
 */

export const ROLES = Object.freeze({
  USER: "user",
  ADMIN: "admin",
  MODERATOR: "moderator",
});

export const TOKEN_USE = Object.freeze({
  ACCESS: "access",
  ID: "id",
});

export const AUTH_FLOWS = Object.freeze({
  USER_PASSWORD: "USER_PASSWORD_AUTH",
  REFRESH_TOKEN: "REFRESH_TOKEN_AUTH",
});

export const ERROR_MESSAGES = Object.freeze({
  // Auth
  INVALID_CREDENTIALS: "Invalid email or password",
  TOKEN_MISSING: "Authentication token is missing",
  TOKEN_INVALID: "Authentication token is invalid or expired",
  TOKEN_EXPIRED: "Authentication token has expired",
  EMAIL_NOT_VERIFIED: "Email address has not been verified",
  USER_EXISTS: "A user with this email already exists",
  USER_NOT_FOUND: "User not found",
  INVALID_VERIFICATION_CODE: "Invalid or expired verification code",
  PASSWORD_MISMATCH: "New password cannot be the same as the old password",

  // Authorization
  FORBIDDEN: "You do not have permission to perform this action",
  INSUFFICIENT_ROLE: "Insufficient role privileges",

  // General
  NOT_FOUND: "The requested resource was not found",
  INTERNAL_ERROR: "An unexpected error occurred",
  VALIDATION_ERROR: "Validation failed",
  RATE_LIMITED: "Too many requests, please try again later",
});

export const PAGINATION = Object.freeze({
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
});
