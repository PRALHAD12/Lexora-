import ApiError from "../utils/ApiError.js";
import { ERROR_MESSAGES } from "../utils/constants.js";

/**
 * Role-Based Access Control (RBAC) middleware factory.
 *
 * Checks whether the authenticated user has one of the allowed roles.
 * Must be used AFTER the authenticate middleware (which sets req.user).
 *
 * Usage:
 *   router.get('/admin', authenticate, authorize('admin'), controller.adminOnly);
 *   router.get('/mod', authenticate, authorize('admin', 'moderator'), controller.modPanel);
 *
 * @param {...string} allowedRoles - Roles permitted to access the route
 * @returns {Function} Express middleware
 */
const authorize = (...allowedRoles) => {
  return (req, _res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized(ERROR_MESSAGES.TOKEN_MISSING));
    }

    const userRole = req.user.role;
    const cognitoGroups = req.user.cognitoGroups || [];

    // Check local DB role
    const hasRole = allowedRoles.includes(userRole);

    // Also check Cognito groups (groups are often used for roles in Cognito)
    const hasGroup = cognitoGroups.some((group) =>
      allowedRoles.includes(group.toLowerCase()),
    );

    if (!hasRole && !hasGroup) {
      return next(
        ApiError.forbidden(
          `${ERROR_MESSAGES.INSUFFICIENT_ROLE}. Required: ${allowedRoles.join(" or ")}`,
        ),
      );
    }

    next();
  };
};

export default authorize;
