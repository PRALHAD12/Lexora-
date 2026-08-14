import { Router } from "express";
import * as orgController from "./organization.controller.js";
import {
  createOrganizationValidation,
  updateOrganizationValidation,
  deleteOrganizationValidation,
  inviteMemberValidation,
  removeMemberValidation,
  updateMemberRoleValidation,
  createProjectValidation,
  updateProjectValidation,
  deleteProjectValidation,
} from "./organization.validation.js";
import validate from "../../middleware/validate.js";
import authenticate from "../../middleware/authenticate.js";

const router = Router();

// All routes require authentication
router.use(authenticate);

// ─── Organization Routes ──────────────────────────────────────────

/**
 * @route   POST /api/v1/organizations
 * @desc    Create a new organization
 * @access  Private
 */
router.post(
  "/",
  createOrganizationValidation,
  validate,
  orgController.createOrganization,
);

/**
 * @route   GET /api/v1/organizations/me
 * @desc    Get current user's organizations with projects & members
 * @access  Private
 */
router.get("/me", orgController.getMyOrganizations);

/**
 * @route   PUT /api/v1/organizations/:id
 * @desc    Update an organization (name, description, industry)
 * @access  Private (Owner or Admin)
 */
router.put(
  "/:id",
  updateOrganizationValidation,
  validate,
  orgController.updateOrganization,
);

/**
 * @route   DELETE /api/v1/organizations/:id
 * @desc    Delete an organization and all its projects
 * @access  Private (Owner only)
 */
router.delete(
  "/:id",
  deleteOrganizationValidation,
  validate,
  orgController.deleteOrganization,
);

// ─── Member Management Routes ─────────────────────────────────────

/**
 * @route   GET /api/v1/organizations/:id/members
 * @desc    Get all members of an organization
 * @access  Private (Members)
 */
router.get("/:id/members", orgController.getMembers);

/**
 * @route   POST /api/v1/organizations/:id/members
 * @desc    Invite / add a member by email
 * @access  Private (Owner or Admin)
 */
router.post(
  "/:id/members",
  inviteMemberValidation,
  validate,
  orgController.inviteMember,
);

/**
 * @route   DELETE /api/v1/organizations/:id/members/:memberId
 * @desc    Remove a member from the organization
 * @access  Private (Owner or Admin)
 */
router.delete(
  "/:id/members/:memberId",
  removeMemberValidation,
  validate,
  orgController.removeMember,
);

/**
 * @route   PATCH /api/v1/organizations/:id/members/:memberId
 * @desc    Update a member's role
 * @access  Private (Owner or Admin)
 */
router.patch(
  "/:id/members/:memberId",
  updateMemberRoleValidation,
  validate,
  orgController.updateMemberRole,
);

// ─── Project Routes ───────────────────────────────────────────────

/**
 * @route   POST /api/v1/organizations/:orgId/projects
 * @desc    Create a project under an organization
 * @access  Private (Members)
 */
router.post(
  "/:orgId/projects",
  createProjectValidation,
  validate,
  orgController.createProject,
);

/**
 * @route   GET /api/v1/organizations/:orgId/projects
 * @desc    List all projects for an organization
 * @access  Private (Members)
 */
router.get("/:orgId/projects", orgController.getProjects);

/**
 * @route   PUT /api/v1/organizations/:orgId/projects/:projectId
 * @desc    Update a project
 * @access  Private (Members)
 */
router.put(
  "/:orgId/projects/:projectId",
  updateProjectValidation,
  validate,
  orgController.updateProject,
);

/**
 * @route   DELETE /api/v1/organizations/:orgId/projects/:projectId
 * @desc    Delete a project
 * @access  Private (Owner or Creator)
 */
router.delete(
  "/:orgId/projects/:projectId",
  deleteProjectValidation,
  validate,
  orgController.deleteProject,
);

export default router;
