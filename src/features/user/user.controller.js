import userService from './user.service.js';
import ApiResponse from '../../utils/ApiResponse.js';
import asyncHandler from '../../utils/asyncHandler.js';
import ApiError from '../../utils/ApiError.js';

/**
 * GET /api/v1/users
 * List all users (Admin only).
 */
export const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, role, isActive, search } = req.query;
  const result = await userService.listUsers({
    page: parseInt(page, 10) || undefined,
    limit: parseInt(limit, 10) || undefined,
    role,
    isActive: isActive !== undefined ? isActive === 'true' : undefined,
    search,
  });

  // Set pagination headers
  res.set('X-Total-Count', result.total.toString());
  res.set('X-Page', result.page.toString());
  res.set('X-Limit', result.limit.toString());

  return ApiResponse.ok(res, 'Users retrieved', result);
});

/**
 * GET /api/v1/users/:id
 * Get user by ID (Admin or Self).
 */
export const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Non-admin users can only access their own profile
  if (req.user.role !== 'admin' && req.user.id !== id) {
    throw ApiError.forbidden('You can only access your own profile');
  }

  const user = await userService.getUserById(id);
  return ApiResponse.ok(res, 'User retrieved', user);
});

/**
 * PATCH /api/v1/users/:id
 * Update user profile (Admin or Self).
 */
export const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Non-admin users can only update their own profile
  if (req.user.role !== 'admin' && req.user.id !== id) {
    throw ApiError.forbidden('You can only update your own profile');
  }

  const user = await userService.updateUser(id, req.body);
  return ApiResponse.ok(res, 'User updated', user);
});

/**
 * DELETE /api/v1/users/:id
 * Soft-delete / deactivate user (Admin only).
 */
export const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await userService.deleteUser(id);
  return ApiResponse.ok(res, result.message);
});

/**
 * PATCH /api/v1/users/:id/role
 * Change user role (Admin only).
 */
export const changeRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  const user = await userService.changeRole(id, role);
  return ApiResponse.ok(res, 'User role updated', user);
});

export default {
  listUsers,
  getUserById,
  updateUser,
  deleteUser,
  changeRole,
};
