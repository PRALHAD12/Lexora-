import { Router } from "express";
import * as userController from "./user.controller.js";
import {
  getUserByIdValidation,
  updateUserValidation,
  deleteUserValidation,
  changeRoleValidation,
  listUsersValidation,
} from "./user.validation.js";
import validate from "../../middleware/validate.js";
import authenticate from "../../middleware/authenticate.js";
import authorize from "../../middleware/authorize.js";
import { ROLES } from "../../utils/constants.js";

const router = Router();

// All user routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/users/me/dashboard-stats
 * @desc    Get real-time dashboard analytics metrics for logged in user
 * @access  Authenticated user
 */
router.get("/me/dashboard-stats", userController.getDashboardStats);

/**
 * @route   GET /api/v1/users
 * @desc    List all users with pagination and filtering
 * @access  Admin only
 */
router.get(
  "/",
  authorize(ROLES.ADMIN),
  listUsersValidation,
  validate,
  userController.listUsers,
);

/**
 * @route   GET /api/v1/users/:id
 * @desc    Get a single user by ID
 * @access  Admin or Self
 */
router.get("/:id", getUserByIdValidation, validate, userController.getUserById);

/**
 * @route   PATCH /api/v1/users/:id
 * @desc    Update user profile
 * @access  Admin or Self
 */
router.patch("/:id", updateUserValidation, validate, userController.updateUser);

/**
 * @route   DELETE /api/v1/users/:id
 * @desc    Soft-delete (deactivate) a user
 * @access  Admin only
 */
router.delete(
  "/:id",
  authorize(ROLES.ADMIN),
  deleteUserValidation,
  validate,
  userController.deleteUser,
);

/**
 * @route   PATCH /api/v1/users/:id/role
 * @desc    Change a user's role
 * @access  Admin only
 */
router.patch(
  "/:id/role",
  authorize(ROLES.ADMIN),
  changeRoleValidation,
  validate,
  userController.changeRole,
);

export default router;
