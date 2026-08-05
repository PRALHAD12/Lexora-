import { body, param, query } from "express-validator";
import { ROLES } from "../../utils/constants.js";

export const getUserByIdValidation = [
  param("id").isMongoId().withMessage("Invalid user ID format"),
];

export const updateUserValidation = [
  param("id").isMongoId().withMessage("Invalid user ID format"),
  body("firstName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("First name must be between 2 and 50 characters"),
  body("lastName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Last name must be between 2 and 50 characters"),
  body("bio")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Bio must not exceed 500 characters"),
  body("avatar")
    .optional()
    .trim()
    .isURL()
    .withMessage("Avatar must be a valid URL"),
];

export const deleteUserValidation = [
  param("id").isMongoId().withMessage("Invalid user ID format"),
];

export const changeRoleValidation = [
  param("id").isMongoId().withMessage("Invalid user ID format"),
  body("role")
    .notEmpty()
    .withMessage("Role is required")
    .isIn(Object.values(ROLES))
    .withMessage(`Role must be one of: ${Object.values(ROLES).join(", ")}`),
];

export const listUsersValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  query("role")
    .optional()
    .isIn(Object.values(ROLES))
    .withMessage(`Role must be one of: ${Object.values(ROLES).join(", ")}`),
  query("isActive")
    .optional()
    .isIn(["true", "false"])
    .withMessage("isActive must be true or false"),
  query("search")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Search query must be between 1 and 100 characters"),
];

export default {
  getUserByIdValidation,
  updateUserValidation,
  deleteUserValidation,
  changeRoleValidation,
  listUsersValidation,
};
