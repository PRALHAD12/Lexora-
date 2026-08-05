import { Router } from 'express';
import * as authController from './auth.controller.js';
import {
  registerValidation,
  loginValidation,
  verifyEmailValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  refreshTokenValidation,
  changePasswordValidation,
  resendVerificationValidation,
} from './auth.validation.js';
import validate from '../../middleware/validate.js';
import authenticate from '../../middleware/authenticate.js';
import { authLimiter } from '../../middleware/rateLimiter.js';

const router = Router();

// ─── Public Routes (rate-limited) ─────────────────────────────────

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', authLimiter, registerValidation, validate, authController.register);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Sign in with email and password
 * @access  Public
 */
router.post('/login', authLimiter, loginValidation, validate, authController.login);

/**
 * @route   POST /api/v1/auth/verify-email
 * @desc    Confirm email with verification code
 * @access  Public
 */
router.post('/verify-email', authLimiter, verifyEmailValidation, validate, authController.verifyEmail);

/**
 * @route   POST /api/v1/auth/resend-verification
 * @desc    Resend email verification code
 * @access  Public
 */
router.post('/resend-verification', authLimiter, resendVerificationValidation, validate, authController.resendVerification);

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Initiate password reset
 * @access  Public
 */
router.post('/forgot-password', authLimiter, forgotPasswordValidation, validate, authController.forgotPassword);

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Confirm password reset with code + new password
 * @access  Public
 */
router.post('/reset-password', authLimiter, resetPasswordValidation, validate, authController.resetPassword);

/**
 * @route   POST /api/v1/auth/refresh-token
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh-token', refreshTokenValidation, validate, authController.refreshToken);

// ─── Protected Routes ─────────────────────────────────────────────

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authenticate, authController.getMe);

/**
 * @route   POST /api/v1/auth/change-password
 * @desc    Change password for authenticated user
 * @access  Private
 */
router.post('/change-password', authenticate, changePasswordValidation, validate, authController.changePassword);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Global sign out (invalidates all tokens)
 * @access  Private
 */
router.post('/logout', authenticate, authController.logout);

export default router;
