import { body, param } from "express-validator";

// ─── Organization Validations ─────────────────────────────────────

export const createOrganizationValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Organization name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Organization name must be between 2 and 100 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description must be at most 500 characters"),
  body("industry")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Industry must be at most 100 characters"),
];

export const updateOrganizationValidation = [
  param("id").isMongoId().withMessage("Invalid organization ID"),
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Organization name must be between 2 and 100 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description must be at most 500 characters"),
  body("industry")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Industry must be at most 100 characters"),
];

// ─── Project Validations ──────────────────────────────────────────

export const createProjectValidation = [
  param("orgId").isMongoId().withMessage("Invalid organization ID"),
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Project name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Project name must be between 2 and 100 characters"),
  body("description")
    .trim()
    .notEmpty()
    .withMessage("Project description is required")
    .isLength({ min: 2, max: 1000 })
    .withMessage("Project description must be between 2 and 1000 characters"),
  body("color")
    .optional()
    .trim()
    .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .withMessage("Color must be a valid hex color code"),
];

export const updateProjectValidation = [
  param("orgId").isMongoId().withMessage("Invalid organization ID"),
  param("projectId").isMongoId().withMessage("Invalid project ID"),
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Project name must be between 2 and 100 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Project description must be at most 1000 characters"),
  body("status")
    .optional()
    .isIn(["active", "archived", "completed"])
    .withMessage("Status must be active, archived, or completed"),
  body("color")
    .optional()
    .trim()
    .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .withMessage("Color must be a valid hex color code"),
];

export const deleteProjectValidation = [
  param("orgId").isMongoId().withMessage("Invalid organization ID"),
  param("projectId").isMongoId().withMessage("Invalid project ID"),
];
