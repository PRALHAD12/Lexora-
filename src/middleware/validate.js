import { validationResult } from 'express-validator';
import ApiError from '../utils/ApiError.js';
import { ERROR_MESSAGES } from '../utils/constants.js';

/**
 * Generic validation middleware.
 * Runs after express-validator checks and collects any errors.
 *
 * Usage:
 *   router.post('/path', [...validationRules], validate, controller.handler);
 */
const validate = (req, _res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const extractedErrors = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
      value: err.value,
    }));

    throw new ApiError(400, ERROR_MESSAGES.VALIDATION_ERROR, {
      errors: extractedErrors,
    });
  }

  next();
};

export default validate;
