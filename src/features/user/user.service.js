import User from './user.model.js';
import ApiError from '../../utils/ApiError.js';
import { ERROR_MESSAGES, PAGINATION, ROLES } from '../../utils/constants.js';
import logger from '../../utils/logger.js';

/**
 * User Service — handles local user profile CRUD operations.
 */
class UserService {
  /**
   * List users with pagination and filtering.
   *
   * @param {object} params
   * @param {number} [params.page=1]
   * @param {number} [params.limit=20]
   * @param {string} [params.role] - Filter by role
   * @param {boolean} [params.isActive] - Filter by active status
   * @param {string} [params.search] - Search by name or email
   * @returns {{ users, total, page, limit, totalPages }}
   */
  async listUsers({ page = PAGINATION.DEFAULT_PAGE, limit = PAGINATION.DEFAULT_LIMIT, role, isActive, search } = {}) {
    const query = {};

    if (role) {
      query.role = role;
    }
    if (isActive !== undefined) {
      query.isActive = isActive;
    }
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const safeLimit = Math.min(limit, PAGINATION.MAX_LIMIT);
    const skip = (page - 1) * safeLimit;

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-__v')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      User.countDocuments(query),
    ]);

    return {
      users,
      total,
      page,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  /**
   * Get a single user by ID.
   *
   * @param {string} userId
   * @returns {object} User document
   */
  async getUserById(userId) {
    const user = await User.findById(userId).select('-__v').lean();

    if (!user) {
      throw ApiError.notFound(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    return user;
  }

  /**
   * Update a user's profile.
   *
   * @param {string} userId
   * @param {object} updateData - Fields to update (firstName, lastName, bio, avatar)
   * @returns {object} Updated user
   */
  async updateUser(userId, updateData) {
    // Only allow specific fields to be updated
    const allowedFields = ['firstName', 'lastName', 'bio', 'avatar'];
    const sanitized = {};
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        sanitized[field] = updateData[field];
      }
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: sanitized },
      { new: true, runValidators: true }
    )
      .select('-__v')
      .lean();

    if (!user) {
      throw ApiError.notFound(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    logger.info(`User updated: ${user.email}`);
    return user;
  }

  /**
   * Soft-delete a user (set isActive to false).
   *
   * @param {string} userId
   * @returns {object} { message }
   */
  async deleteUser(userId) {
    const user = await User.findByIdAndUpdate(
      userId,
      { isActive: false },
      { new: true }
    );

    if (!user) {
      throw ApiError.notFound(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    logger.info(`User deactivated: ${user.email}`);
    return { message: 'User deactivated successfully' };
  }

  /**
   * Change a user's role (admin only).
   *
   * @param {string} userId
   * @param {string} newRole
   * @returns {object} Updated user
   */
  async changeRole(userId, newRole) {
    if (!Object.values(ROLES).includes(newRole)) {
      throw ApiError.badRequest(`Invalid role. Must be one of: ${Object.values(ROLES).join(', ')}`);
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { role: newRole },
      { new: true, runValidators: true }
    )
      .select('-__v')
      .lean();

    if (!user) {
      throw ApiError.notFound(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    logger.info(`User role changed: ${user.email} → ${newRole}`);
    return user;
  }
}

export default new UserService();
