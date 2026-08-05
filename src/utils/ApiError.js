/**
 * Custom operational error class for API responses.
 * Extends the native Error with HTTP status codes and an operational flag
 * to distinguish expected errors from programming bugs.
 */
class ApiError extends Error {
  /**
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Error message
   * @param {object} [options]
   * @param {boolean} [options.isOperational=true] - Whether this is an expected operational error
   * @param {Array} [options.errors=[]] - Validation errors or additional error details
   * @param {string} [options.stack] - Optional stack trace override
   */
  constructor(statusCode, message, { isOperational = true, errors = [], stack } = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errors = errors;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  static badRequest(message = 'Bad request', errors = []) {
    return new ApiError(400, message, { errors });
  }

  static unauthorized(message = 'Unauthorized') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'Forbidden') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message);
  }

  static conflict(message = 'Conflict') {
    return new ApiError(409, message);
  }

  static tooManyRequests(message = 'Too many requests') {
    return new ApiError(429, message);
  }

  static internal(message = 'Internal server error') {
    return new ApiError(500, message, { isOperational: false });
  }
}

export default ApiError;
