import Organization from "./Organization.model.js";
import Project from "./Project.model.js";
import ApiResponse from "../../utils/ApiResponse.js";
import ApiError from "../../utils/ApiError.js";
import asyncHandler from "../../utils/asyncHandler.js";
import logger from "../../utils/logger.js";

// ═══════════════════════════════════════════════════════════════════
//  ORGANIZATION CONTROLLERS
// ═══════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/organizations
 * Create a new organization for the authenticated user.
 */
export const createOrganization = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?.sub;
  const { name, description, industry } = req.body;

  // Check if user already owns an organization
  const existingOrg = await Organization.findOne({ owner: userId });
  if (existingOrg) {
    throw ApiError.conflict(
      "You already have an organization. Update it instead.",
    );
  }

  const organization = await Organization.create({
    name,
    description: description || "",
    industry: industry || "",
    owner: userId,
    members: [{ userId, role: "owner", joinedAt: new Date() }],
  });

  logger.info(`Organization created: ${name} by user ${userId}`);

  return ApiResponse.created(
    res,
    "Organization created successfully",
    organization,
  );
});

/**
 * GET /api/v1/organizations/me
 * Get all organizations the current user belongs to.
 */
export const getMyOrganizations = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?.sub;

  const organizations = await Organization.find({
    $or: [{ owner: userId }, { "members.userId": userId }],
    isActive: true,
  })
    .sort({ createdAt: -1 })
    .lean();

  // For each organization, also fetch its projects
  const orgsWithProjects = await Promise.all(
    organizations.map(async (org) => {
      const projects = await Project.find({ organizationId: org._id })
        .sort({ createdAt: -1 })
        .lean();
      return {
        ...org,
        id: org._id,
        projects,
      };
    }),
  );

  return ApiResponse.ok(
    res,
    "Organizations retrieved successfully",
    orgsWithProjects,
  );
});

/**
 * PUT /api/v1/organizations/:id
 * Update an organization (owner only).
 */
export const updateOrganization = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?.sub;
  const { id } = req.params;
  const { name, description, industry } = req.body;

  const organization = await Organization.findById(id);
  if (!organization) {
    throw ApiError.notFound("Organization not found");
  }

  if (organization.owner.toString() !== userId) {
    throw ApiError.forbidden("Only the organization owner can update it");
  }

  if (name) {
    organization.name = name;
  }
  if (description !== undefined) {
    organization.description = description;
  }
  if (industry !== undefined) {
    organization.industry = industry;
  }

  await organization.save();

  logger.info(`Organization updated: ${organization.name} by user ${userId}`);

  return ApiResponse.ok(res, "Organization updated successfully", organization);
});

// ═══════════════════════════════════════════════════════════════════
//  PROJECT CONTROLLERS
// ═══════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/organizations/:orgId/projects
 * Create a new project under an organization.
 */
export const createProject = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?.sub;
  const { orgId } = req.params;
  const { name, description, color } = req.body;

  // Verify the user belongs to this organization
  const organization = await Organization.findById(orgId);
  if (!organization) {
    throw ApiError.notFound("Organization not found");
  }

  const isMember =
    organization.owner.toString() === userId ||
    organization.members.some((m) => m.userId.toString() === userId);

  if (!isMember) {
    throw ApiError.forbidden("You are not a member of this organization");
  }

  const project = await Project.create({
    name,
    description,
    organizationId: orgId,
    createdBy: userId,
    color: color || "#3B82F6",
  });

  logger.info(
    `Project created: ${name} in org ${organization.name} by user ${userId}`,
  );

  return ApiResponse.created(res, "Project created successfully", project);
});

/**
 * GET /api/v1/organizations/:orgId/projects
 * List all projects for an organization.
 */
export const getProjects = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?.sub;
  const { orgId } = req.params;

  // Verify the user belongs to this organization
  const organization = await Organization.findById(orgId);
  if (!organization) {
    throw ApiError.notFound("Organization not found");
  }

  const isMember =
    organization.owner.toString() === userId ||
    organization.members.some((m) => m.userId.toString() === userId);

  if (!isMember) {
    throw ApiError.forbidden("You are not a member of this organization");
  }

  const projects = await Project.find({ organizationId: orgId })
    .sort({ createdAt: -1 })
    .lean();

  return ApiResponse.ok(res, "Projects retrieved successfully", projects);
});

/**
 * PUT /api/v1/organizations/:orgId/projects/:projectId
 * Update a project.
 */
export const updateProject = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?.sub;
  const { orgId, projectId } = req.params;
  const { name, description, status, color } = req.body;

  const organization = await Organization.findById(orgId);
  if (!organization) {
    throw ApiError.notFound("Organization not found");
  }

  const isMember =
    organization.owner.toString() === userId ||
    organization.members.some((m) => m.userId.toString() === userId);

  if (!isMember) {
    throw ApiError.forbidden("You are not a member of this organization");
  }

  const project = await Project.findOne({
    _id: projectId,
    organizationId: orgId,
  });
  if (!project) {
    throw ApiError.notFound("Project not found");
  }

  if (name) {
    project.name = name;
  }
  if (description !== undefined) {
    project.description = description;
  }
  if (status) {
    project.status = status;
  }
  if (color) {
    project.color = color;
  }

  await project.save();

  logger.info(`Project updated: ${project.name} by user ${userId}`);

  return ApiResponse.ok(res, "Project updated successfully", project);
});

/**
 * DELETE /api/v1/organizations/:orgId/projects/:projectId
 * Delete a project.
 */
export const deleteProject = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?.sub;
  const { orgId, projectId } = req.params;

  const organization = await Organization.findById(orgId);
  if (!organization) {
    throw ApiError.notFound("Organization not found");
  }

  // Only owner or creator can delete
  const isOwner = organization.owner.toString() === userId;

  const project = await Project.findOne({
    _id: projectId,
    organizationId: orgId,
  });
  if (!project) {
    throw ApiError.notFound("Project not found");
  }

  const isCreator = project.createdBy.toString() === userId;

  if (!isOwner && !isCreator) {
    throw ApiError.forbidden(
      "Only the organization owner or project creator can delete a project",
    );
  }

  await Project.findByIdAndDelete(projectId);

  logger.info(`Project deleted: ${project.name} by user ${userId}`);

  return ApiResponse.ok(res, "Project deleted successfully");
});

export default {
  createOrganization,
  getMyOrganizations,
  updateOrganization,
  createProject,
  getProjects,
  updateProject,
  deleteProject,
};
