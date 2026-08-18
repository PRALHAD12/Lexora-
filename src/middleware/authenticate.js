import { accessTokenVerifier, idTokenVerifier } from "../config/aws.js";
import ApiError from "../utils/ApiError.js";
import { ERROR_MESSAGES } from "../utils/constants.js";
import logger from "../utils/logger.js";
import User from "../features/user/user.model.js";

/**
 * Authentication middleware.
 * Verifies the AWS Cognito JWT token (Access token or ID token) from the Authorization header
 * and attaches the decoded user payload + local DB profile to req.user.
 *
 * Expected header format: Authorization: Bearer <token>
 */
export const authenticate = async (req, _res, next) => {
  try {
    // 1. Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw ApiError.unauthorized(ERROR_MESSAGES.TOKEN_MISSING);
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      throw ApiError.unauthorized(ERROR_MESSAGES.TOKEN_MISSING);
    }

    // 2. Verify token with AWS Cognito (check access token, fallback to ID token)
    let payload;
    try {
      payload = await accessTokenVerifier.verify(token);
    } catch (accessErr) {
      try {
        payload = await idTokenVerifier.verify(token);
      } catch (idErr) {
        logger.warn("JWT verification failed:", {
          accessError: accessErr.message,
          idError: idErr.message,
          ip: req.ip,
        });
      }
    }

    if (!payload || !payload.sub) {
      throw ApiError.unauthorized(ERROR_MESSAGES.TOKEN_INVALID);
    }

    // 3. Enrich with local user profile from DB (query by cognitoSub OR email)
    const queryConds = [{ cognitoSub: payload.sub }];
    if (payload.email) {
      queryConds.push({ email: payload.email.toLowerCase() });
    }
    if (payload.username && payload.username.includes("@")) {
      queryConds.push({ email: payload.username.toLowerCase() });
    }

    let localUser = await User.findOne({ $or: queryConds }).lean();
    if (!localUser && payload.email) {
      localUser = await User.findOne({
        email: payload.email.toLowerCase(),
      }).lean();
    }

    // 4. Attach user info to request
    req.user = {
      sub: payload.sub,
      email: payload.email || localUser?.email,
      cognitoGroups: payload["cognito:groups"] || [],
      tokenUse: payload.token_use,
      scope: payload.scope,
      // Local DB fields
      id: localUser?._id?.toString(),
      role: localUser?.role || "user",
      firstName: localUser?.firstName,
      lastName: localUser?.lastName,
      isActive: localUser?.isActive ?? true,
    };

    // 5. Check if user account is active
    if (localUser && !localUser.isActive) {
      throw ApiError.forbidden("Your account has been deactivated");
    }

    next();
  } catch (error) {
    next(error);
  }
};

export default authenticate;
