import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import config from '../config/index.js';

/**
 * Maps known AWS Cognito error names to user-friendly ApiError responses.
 */
const cognitoErrorMap = {
  UserNotFoundException: (msg) => ApiError.notFound(msg || 'User not found'),
  UsernameExistsException: (msg) => ApiError.conflict(msg || 'A user with this email already exists'),
  NotAuthorizedException: (msg) => ApiError.unauthorized(msg || 'Invalid credentials'),
  UserNotConfirmedException: (msg) => ApiError.forbidden(msg || 'Email address has not been verified'),
  CodeMismatchException: (msg) => ApiError.badRequest(msg || 'Invalid verification code'),
  ExpiredCodeException: (msg) => ApiError.badRequest(msg || 'Verification code has expired'),
  InvalidPasswordException: (msg) => ApiError.badRequest(msg || 'Password does not meet requirements'),
  LimitExceededException: (msg) => ApiError.tooManyRequests(msg || 'Too many attempts, please try again later'),
  TooManyRequestsException: () => ApiError.tooManyRequests(),
  InvalidParameterException: (msg) => ApiError.badRequest(msg || 'Invalid parameter'),
};

/**
 * Global error handler middleware.
 * Must be registered AFTER all routes in Express.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, _req, res, _next) => {
  // 1. Handle AWS Cognito SDK errors
  if (err.name && cognitoErrorMap[err.name]) {
    const apiError = cognitoErrorMap[err.name](err.message);
    return res.status(apiError.statusCode).json({
      success: false,
      message: apiError.message,
      ...(config.app.isProduction ? {} : { stack: err.stack }),
    });
  }

  // 2. Handle known ApiErrors
  if (err instanceof ApiError) {
    logger.warn(`ApiError [${err.statusCode}]: ${err.message}`);
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors.length > 0 ? err.errors : undefined,
      ...(config.app.isProduction ? {} : { stack: err.stack }),
    });
  }

  // 3. Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
  }

  // 4. Handle Mongoose cast errors (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: `Invalid ${err.path}: ${err.value}`,
    });
  }

  // 5. Handle Mongoose duplicate key errors
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({
      success: false,
      message: `Duplicate value for field: ${field}`,
    });
  }

  // 6. Handle CORS errors
  if (err.message && err.message.includes('not allowed by CORS')) {
    return res.status(403).json({
      success: false,
      message: err.message,
    });
  }

  // 7. Unexpected / programming errors
  logger.error('Unhandled error:', err);

  return res.status(500).json({
    success: false,
    message: config.app.isProduction
      ? 'An unexpected error occurred'
      : err.message,
    ...(config.app.isProduction ? {} : { stack: err.stack }),
  });
};

export default errorHandler;
