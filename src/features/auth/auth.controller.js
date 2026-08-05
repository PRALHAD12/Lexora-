import authService from "./auth.service.js";
import ApiResponse from "../../utils/ApiResponse.js";
import asyncHandler from "../../utils/asyncHandler.js";

/**
 * POST /api/v1/auth/register
 * Register a new user.
 */
export const register = asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName } = req.body;
  const result = await authService.signUp({
    email,
    password,
    firstName,
    lastName,
  });
  return ApiResponse.created(res, result.message, {
    userSub: result.userSub,
    isConfirmed: result.isConfirmed,
  });
});

/**
 * POST /api/v1/auth/verify-email
 * Verify email with the confirmation code.
 */
export const verifyEmail = asyncHandler(async (req, res) => {
  const { email, code } = req.body;
  const result = await authService.confirmSignUp({ email, code });
  return ApiResponse.ok(res, result.message);
});

/**
 * POST /api/v1/auth/login
 * Sign in with email and password.
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.signIn({ email, password });

  // If a challenge is returned (MFA, etc.), send it back
  if (result.challengeName) {
    return ApiResponse.ok(res, result.message, {
      challengeName: result.challengeName,
      session: result.session,
      challengeParameters: result.challengeParameters,
    });
  }

  return ApiResponse.ok(res, "Login successful", {
    accessToken: result.accessToken,
    idToken: result.idToken,
    refreshToken: result.refreshToken,
    expiresIn: result.expiresIn,
    tokenType: result.tokenType,
    user: result.user,
  });
});

/**
 * POST /api/v1/auth/refresh-token
 * Refresh the access token using a refresh token.
 */
export const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken: token } = req.body;
  const result = await authService.refreshToken({ refreshToken: token });
  return ApiResponse.ok(res, "Token refreshed successfully", result);
});

/**
 * POST /api/v1/auth/forgot-password
 * Initiate password reset flow.
 */
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const result = await authService.forgotPassword({ email });
  return ApiResponse.ok(res, result.message);
});

/**
 * POST /api/v1/auth/reset-password
 * Confirm password reset with code and new password.
 */
export const resetPassword = asyncHandler(async (req, res) => {
  const { email, code, newPassword } = req.body;
  const result = await authService.confirmForgotPassword({
    email,
    code,
    newPassword,
  });
  return ApiResponse.ok(res, result.message);
});

/**
 * POST /api/v1/auth/change-password
 * Change password for the authenticated user.
 */
export const changePassword = asyncHandler(async (req, res) => {
  const { previousPassword, proposedPassword } = req.body;
  const accessToken = req.headers.authorization.split(" ")[1];
  const result = await authService.changePassword({
    accessToken,
    previousPassword,
    proposedPassword,
  });
  return ApiResponse.ok(res, result.message);
});

/**
 * POST /api/v1/auth/logout
 * Global sign out (invalidates all tokens).
 */
export const logout = asyncHandler(async (req, res) => {
  const accessToken = req.headers.authorization.split(" ")[1];
  const result = await authService.globalSignOut({ accessToken });
  return ApiResponse.ok(res, result.message);
});

/**
 * GET /api/v1/auth/me
 * Get current user profile.
 */
export const getMe = asyncHandler(async (req, res) => {
  const accessToken = req.headers.authorization.split(" ")[1];
  const profile = await authService.getProfile({
    accessToken,
    sub: req.user.sub,
  });
  return ApiResponse.ok(res, "User profile retrieved", profile);
});

/**
 * POST /api/v1/auth/resend-verification
 * Resend the email verification code.
 */
export const resendVerification = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const result = await authService.resendVerificationCode({ email });
  return ApiResponse.ok(res, result.message);
});

export default {
  register,
  verifyEmail,
  login,
  refreshToken,
  forgotPassword,
  resetPassword,
  changePassword,
  logout,
  getMe,
  resendVerification,
};
