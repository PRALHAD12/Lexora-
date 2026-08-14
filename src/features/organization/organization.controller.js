import Organization from "./Organization.model.js";
import Project from "./Project.model.js";
import User from "../user/user.model.js";
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
    .populate("members.userId", "firstName lastName email avatar role")
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
 * Update an organization (owner or admin).
 */
export const updateOrganization = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?.sub;
  const { id } = req.params;
  const { name, description, industry } = req.body;

  const organization = await Organization.findById(id);
  if (!organization) {
    throw ApiError.notFound("Organization not found");
  }

  const isOwner = organization.owner.toString() === userId;
  const isAdmin = organization.members.some(
    (m) => m.userId.toString() === userId && m.role === "admin",
  );

  if (!isOwner && !isAdmin) {
    throw ApiError.forbidden(
      "Only the organization owner or admin can update it",
    );
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

/**
 * DELETE /api/v1/organizations/:id
 * Delete an organization and its associated projects (owner only).
 */
export const deleteOrganization = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?.sub;
  const { id } = req.params;

  const organization = await Organization.findById(id);
  if (!organization) {
    throw ApiError.notFound("Organization not found");
  }

  if (organization.owner.toString() !== userId) {
    throw ApiError.forbidden("Only the organization owner can delete it");
  }

  // Delete all projects under this organization
  await Project.deleteMany({ organizationId: id });

  // Delete the organization
  await Organization.findByIdAndDelete(id);

  logger.info(`Organization deleted: ${organization.name} by user ${userId}`);

  return ApiResponse.ok(
    res,
    "Organization and associated projects deleted successfully",
  );
});

// ═══════════════════════════════════════════════════════════════════
//  MEMBER MANAGEMENT CONTROLLERS
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/organizations/:id/members
 * Get all members of an organization.
 */
export const getMembers = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?.sub;
  const { id } = req.params;

  const organization = await Organization.findById(id).populate(
    "members.userId",
    "firstName lastName email avatar role",
  );

  if (!organization) {
    throw ApiError.notFound("Organization not found");
  }

  const isMember =
    organization.owner.toString() === userId ||
    organization.members.some(
      (m) => m.userId && m.userId._id.toString() === userId,
    );

  if (!isMember) {
    throw ApiError.forbidden("You are not a member of this organization");
  }

  return ApiResponse.ok(
    res,
    "Members retrieved successfully",
    organization.members,
  );
});

/**
 * POST /api/v1/organizations/:id/members
 * Invite / add a member to the organization by email.
 */
export const inviteMember = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?.sub;
  const { id } = req.params;
  const { email, role = "viewer" } = req.body;

  const organization = await Organization.findById(id);
  if (!organization) {
    throw ApiError.notFound("Organization not found");
  }

  const isOwner = organization.owner.toString() === userId;
  const isAdmin = organization.members.some(
    (m) => m.userId.toString() === userId && m.role === "admin",
  );

  if (!isOwner && !isAdmin) {
    throw ApiError.forbidden(
      "Only the organization owner or admin can invite members",
    );
  }

  // Find user by email
  const userToInvite = await User.findOne({ email: email.toLowerCase() });
  if (!userToInvite) {
    throw ApiError.notFound(
      `No registered user found with email "${email}". Please ensure they have created a Lexora account first.`,
    );
  }

  // Check if already a member
  const existingMember = organization.members.find(
    (m) => m.userId.toString() === userToInvite._id.toString(),
  );

  if (existingMember) {
    throw ApiError.conflict(
      `User "${email}" is already a member with role "${existingMember.role}".`,
    );
  }

  organization.members.push({
    userId: userToInvite._id,
    role,
    joinedAt: new Date(),
  });

  await organization.save();

  const updatedOrg = await Organization.findById(id).populate(
    "members.userId",
    "firstName lastName email avatar role",
  );

  logger.info(
    `User ${email} added to org ${organization.name} with role ${role}`,
  );

  return ApiResponse.ok(
    res,
    `User ${email} successfully added as ${role}`,
    updatedOrg.members,
  );
});

/**
 * DELETE /api/v1/organizations/:id/members/:memberId
 * Remove a member from the organization.
 */
export const removeMember = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?.sub;
  const { id, memberId } = req.params;

  const organization = await Organization.findById(id);
  if (!organization) {
    throw ApiError.notFound("Organization not found");
  }

  const isOwner = organization.owner.toString() === userId;
  const isAdmin = organization.members.some(
    (m) => m.userId.toString() === userId && m.role === "admin",
  );

  if (!isOwner && !isAdmin) {
    throw ApiError.forbidden(
      "Only the organization owner or admin can remove members",
    );
  }

  // Cannot remove owner
  if (organization.owner.toString() === memberId) {
    throw ApiError.forbidden("Cannot remove the organization owner");
  }

  organization.members = organization.members.filter(
    (m) => m._id.toString() !== memberId && m.userId.toString() !== memberId,
  );

  await organization.save();

  logger.info(`Member ${memberId} removed from org ${organization.name}`);

  return ApiResponse.ok(res, "Member removed successfully");
});

/**
 * PATCH /api/v1/organizations/:id/members/:memberId
 * Update a member's role.
 */
export const updateMemberRole = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?.sub;
  const { id, memberId } = req.params;
  const { role } = req.body;

  const organization = await Organization.findById(id);
  if (!organization) {
    throw ApiError.notFound("Organization not found");
  }

  const isOwner = organization.owner.toString() === userId;
  const isAdmin = organization.members.some(
    (m) => m.userId.toString() === userId && m.role === "admin",
  );

  if (!isOwner && !isAdmin) {
    throw ApiError.forbidden(
      "Only the organization owner or admin can update member roles",
    );
  }

  const member = organization.members.find(
    (m) => m._id.toString() === memberId || m.userId.toString() === memberId,
  );

  if (!member) {
    throw ApiError.notFound("Member not found in organization");
  }

  member.role = role;
  await organization.save();

  logger.info(
    `Member ${memberId} role updated to ${role} in org ${organization.name}`,
  );

  return ApiResponse.ok(res, "Member role updated successfully", member);
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
  deleteOrganization,
  getMembers,
  inviteMember,
  removeMember,
  updateMemberRole,
  createProject,
  getProjects,
  updateProject,
  deleteProject,
};
