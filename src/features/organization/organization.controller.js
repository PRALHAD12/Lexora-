import mongoose from "mongoose";
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
  const userEmail = req.user?.email;
  const { name, description, industry } = req.body;

  // Check if user already owns an organization
  const existingOrg = await Organization.findOne({
    $or: [{ owner: userId }, ...(req.user?.id ? [{ owner: req.user.id }] : [])],
  });
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
    members: [
      {
        userId:
          req.user?.id ||
          (mongoose.Types.ObjectId.isValid(userId) ? userId : undefined),
        email: userEmail ? userEmail.toLowerCase() : undefined,
        role: "owner",
        status: "active",
        joinedAt: new Date(),
      },
    ],
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
 * Get all organizations the current user belongs to as owner or active member.
 */
export const getMyOrganizations = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?.sub;
  const userEmail = req.user?.email ? req.user.email.toLowerCase() : null;

  const orConditions = [
    { owner: userId },
    { members: { $elemMatch: { userId, status: "active" } } },
  ];
  if (req.user?.id) {
    orConditions.push(
      { owner: req.user.id },
      { members: { $elemMatch: { userId: req.user.id, status: "active" } } },
    );
  }
  if (userEmail) {
    orConditions.push({
      members: { $elemMatch: { email: userEmail, status: "active" } },
    });
  }

  const organizations = await Organization.find({
    $or: orConditions,
    isActive: true,
  })
    .populate("members.userId", "firstName lastName email avatar role")
    .sort({ createdAt: -1 })
    .lean();

  // Sort owned organizations first
  organizations.sort((a, b) => {
    const aIsOwner =
      a.owner?.toString() === userId?.toString() ||
      (req.user?.id && a.owner?.toString() === req.user.id);
    const bIsOwner =
      b.owner?.toString() === userId?.toString() ||
      (req.user?.id && b.owner?.toString() === req.user.id);
    if (aIsOwner && !bIsOwner) {
      return -1;
    }
    if (!aIsOwner && bIsOwner) {
      return 1;
    }
    return 0;
  });

  // For each organization, also fetch its projects
  const orgsWithProjects = await Promise.all(
    organizations.map(async (org) => {
      const projects = await Project.find({ organizationId: org._id })
        .populate("createdBy", "firstName lastName email")
        .sort({ createdAt: -1 })
        .lean();

      const normalizedProjects = projects.map((p) => {
        const creatorObj =
          typeof p.createdBy === "object" && p.createdBy !== null
            ? p.createdBy
            : null;
        const creatorName =
          p.creatorName ||
          (creatorObj
            ? `${creatorObj.firstName || ""} ${creatorObj.lastName || ""}`.trim()
            : "Lexora User");
        const creatorEmail =
          p.creatorEmail || creatorObj?.email || "user@lexora.ai";
        return {
          ...p,
          creatorName,
          creatorEmail,
        };
      });

      const isOwner =
        org.owner?.toString() === userId?.toString() ||
        (req.user?.id && org.owner?.toString() === req.user.id);
      const userMember = org.members?.find((m) => {
        const mUserId = m.userId?._id?.toString() || m.userId?.toString();
        const mEmail = m.email || m.userId?.email || "";
        return (
          (mUserId && (mUserId === userId || mUserId === req.user?.id)) ||
          (userEmail && mEmail.toLowerCase() === userEmail)
        );
      });
      const userRole = isOwner ? "owner" : userMember?.role || "viewer";

      return {
        ...org,
        id: org._id,
        isOwner,
        userRole,
        projects: normalizedProjects,
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
 * GET /api/v1/organizations/invitations/me
 * Get all pending organization invitations for the current user.
 */
export const getMyInvitations = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?.sub;
  const userEmail = req.user?.email ? req.user.email.toLowerCase() : null;

  const orConditions = [];
  if (userEmail) {
    orConditions.push({
      members: { $elemMatch: { email: userEmail, status: "pending" } },
    });
  }
  if (req.user?.id && mongoose.Types.ObjectId.isValid(req.user.id)) {
    orConditions.push({
      members: {
        $elemMatch: {
          userId: new mongoose.Types.ObjectId(req.user.id),
          status: "pending",
        },
      },
    });
  }
  if (
    userId &&
    mongoose.Types.ObjectId.isValid(userId) &&
    userId !== req.user?.id
  ) {
    orConditions.push({
      members: {
        $elemMatch: {
          userId: new mongoose.Types.ObjectId(userId),
          status: "pending",
        },
      },
    });
  }

  if (orConditions.length === 0) {
    return ApiResponse.ok(res, "Invitations retrieved successfully", []);
  }

  const organizations = await Organization.find({
    $or: orConditions,
    isActive: true,
  })
    .populate("owner", "firstName lastName email")
    .populate("members.invitedBy", "firstName lastName email")
    .sort({ createdAt: -1 })
    .lean();

  const invitations = [];

  for (const org of organizations) {
    const memberRecord = org.members.find((m) => {
      const mUserId = m.userId?._id?.toString() || m.userId?.toString();
      const mEmail =
        m.email ||
        (m.userId && typeof m.userId === "object" && m.userId.email) ||
        "";
      const isMatch =
        (mUserId && (mUserId === userId || mUserId === req.user?.id)) ||
        (userEmail && mEmail.toLowerCase() === userEmail);
      return isMatch && m.status === "pending";
    });

    if (memberRecord) {
      const inviter = memberRecord.invitedBy || org.owner || {};
      invitations.push({
        id: memberRecord._id,
        organizationId: org._id,
        organizationName: org.name,
        organizationDescription: org.description,
        organizationIndustry: org.industry,
        role: memberRecord.role || "viewer",
        invitedAt: memberRecord.joinedAt,
        invitedBy: {
          name:
            `${inviter.firstName || ""} ${inviter.lastName || ""}`.trim() ||
            inviter.email ||
            "Workspace Admin",
          email: inviter.email || "",
        },
      });
    }
  }

  return ApiResponse.ok(res, "Invitations retrieved successfully", invitations);
});

/**
 * POST /api/v1/organizations/invitations/:orgId/accept
 * Accept an organization invitation.
 */
export const acceptInvitation = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?.sub;
  const userEmail = req.user?.email ? req.user.email.toLowerCase() : null;
  const { orgId } = req.params;

  const organization = await Organization.findById(orgId);
  if (!organization) {
    throw ApiError.notFound("Organization not found");
  }

  const memberRecord = organization.members.find((m) => {
    const mUserId = m.userId?._id?.toString() || m.userId?.toString();
    const mEmail =
      m.email ||
      (m.userId && typeof m.userId === "object" && m.userId.email) ||
      "";
    const isMatch =
      (mUserId && (mUserId === userId || mUserId === req.user?.id)) ||
      (userEmail && mEmail.toLowerCase() === userEmail);
    return isMatch && m.status === "pending" && m.role !== "owner";
  });

  if (!memberRecord) {
    throw ApiError.notFound(
      "No pending invitation found for this organization",
    );
  }

  memberRecord.status = "active";
  if (req.user?.id && mongoose.Types.ObjectId.isValid(req.user.id)) {
    memberRecord.userId = new mongoose.Types.ObjectId(req.user.id);
  }
  memberRecord.respondedAt = new Date();

  // Mark modified to guarantee MongoDB subdocument persistence
  organization.markModified("members");
  await organization.save();

  logger.info(
    `User ${userEmail || userId} accepted invitation to ${organization.name} (${memberRecord.role})`,
  );

  return ApiResponse.ok(
    res,
    `You have accepted the invitation and joined ${organization.name}!`,
    {
      organizationId: organization._id,
      name: organization.name,
      role: memberRecord.role,
    },
  );
});

/**
 * POST /api/v1/organizations/invitations/:orgId/decline
 * Decline an organization invitation.
 */
export const declineInvitation = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?.sub;
  const userEmail = req.user?.email ? req.user.email.toLowerCase() : null;
  const { orgId } = req.params;

  const organization = await Organization.findById(orgId);
  if (!organization) {
    throw ApiError.notFound("Organization not found");
  }

  const memberRecord = organization.members.find((m) => {
    const mUserId = m.userId?._id?.toString() || m.userId?.toString();
    const mEmail =
      m.email ||
      (m.userId && typeof m.userId === "object" && m.userId.email) ||
      "";
    const isMatch =
      (mUserId && (mUserId === userId || mUserId === req.user?.id)) ||
      (userEmail && mEmail.toLowerCase() === userEmail);
    return isMatch && m.status === "pending" && m.role !== "owner";
  });

  if (!memberRecord) {
    throw ApiError.notFound(
      "No pending invitation found for this organization",
    );
  }

  memberRecord.status = "declined";
  memberRecord.respondedAt = new Date();

  // Mark modified to guarantee MongoDB subdocument persistence
  organization.markModified("members");
  await organization.save();

  logger.info(
    `User ${userEmail || userId} declined invitation to ${organization.name}`,
  );

  return ApiResponse.ok(res, `Invitation to ${organization.name} declined`);
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
 * Helper to check if a user is a member of an organization
 */
const checkUserIsMember = (organization, userId, userEmail) => {
  if (!organization) {
    return false;
  }
  const isOwner =
    (organization.owner && organization.owner.toString() === userId) ||
    (organization.owner &&
      organization.owner._id &&
      organization.owner._id.toString() === userId);
  if (isOwner) {
    return true;
  }

  return organization.members.some((m) => {
    const mUserId = m.userId?._id?.toString() || m.userId?.toString();
    const mEmail =
      m.email ||
      (m.userId && typeof m.userId === "object" && m.userId.email) ||
      "";
    return (
      (mUserId &&
        (mUserId === userId ||
          (typeof userId === "string" && mUserId === userId))) ||
      (userEmail && mEmail && mEmail.toLowerCase() === userEmail.toLowerCase())
    );
  });
};

/**
 * Helper to check if a user is an owner or admin of an organization
 */
const checkUserIsAdminOrOwner = (organization, userId, userEmail) => {
  if (!organization) {
    return false;
  }
  const isOwner =
    (organization.owner && organization.owner.toString() === userId) ||
    (organization.owner &&
      organization.owner._id &&
      organization.owner._id.toString() === userId);
  if (isOwner) {
    return true;
  }

  return organization.members.some((m) => {
    const mUserId = m.userId?._id?.toString() || m.userId?.toString();
    const mEmail =
      m.email ||
      (m.userId && typeof m.userId === "object" && m.userId.email) ||
      "";
    const isThisUser =
      (mUserId &&
        (mUserId === userId ||
          (typeof userId === "string" && mUserId === userId))) ||
      (userEmail && mEmail && mEmail.toLowerCase() === userEmail.toLowerCase());
    return isThisUser && (m.role === "admin" || m.role === "owner");
  });
};

/**
 * GET /api/v1/organizations/:id/members
 * Get all members of an organization.
 */
export const getMembers = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?.sub;
  const userEmail = req.user?.email ? req.user.email.toLowerCase() : null;
  const { id } = req.params;

  const organization = await Organization.findById(id).populate(
    "members.userId",
    "firstName lastName email avatar role",
  );

  if (!organization) {
    throw ApiError.notFound("Organization not found");
  }

  const isMember = checkUserIsMember(organization, userId, userEmail);

  if (!isMember) {
    throw ApiError.forbidden("You are not a member of this organization");
  }

  const formattedMembers = organization.members.map((m) => {
    const u =
      typeof m.userId === "object" && m.userId !== null ? m.userId : null;
    return {
      _id: m._id,
      userId: u,
      email: u?.email || m.email || "",
      firstName: u?.firstName || "",
      lastName: u?.lastName || "",
      role: m.role || "viewer",
      status: m.status || (u ? "active" : "pending"),
      joinedAt: m.joinedAt,
    };
  });

  return ApiResponse.ok(
    res,
    "Members retrieved successfully",
    formattedMembers,
  );
});

/**
 * POST /api/v1/organizations/:id/members
 * Invite / add a member to the organization by email.
 */
export const inviteMember = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?.sub;
  const userEmail = req.user?.email ? req.user.email.toLowerCase() : null;
  const { id } = req.params;
  const { email, role = "viewer" } = req.body;

  const organization = await Organization.findById(id);
  if (!organization) {
    throw ApiError.notFound("Organization not found");
  }

  const isAdminOrOwner = checkUserIsAdminOrOwner(
    organization,
    userId,
    userEmail,
  );

  if (!isAdminOrOwner) {
    throw ApiError.forbidden(
      "Only the organization owner or admin can invite members",
    );
  }

  const cleanEmail = email.trim().toLowerCase();
  const inviterId =
    req.user?.id ||
    (mongoose.Types.ObjectId.isValid(userId) ? userId : undefined);

  // Prevent inviting self
  if (userEmail && userEmail === cleanEmail) {
    throw ApiError.conflict(
      "You cannot invite yourself to your own organization",
    );
  }

  // Check if registered locally
  const userToInvite = await User.findOne({ email: cleanEmail });

  // Check if already a member or pending invite
  const existingMember = organization.members.find((m) => {
    const mEmail =
      m.email ||
      (m.userId && typeof m.userId === "object" && m.userId.email) ||
      "";
    return mEmail.toLowerCase() === cleanEmail;
  });

  if (existingMember) {
    if (existingMember.status === "declined") {
      // Re-invite user who previously declined
      existingMember.status = "pending";
      existingMember.role = role;
      existingMember.invitedBy = inviterId;
      existingMember.joinedAt = new Date();
      existingMember.respondedAt = undefined;
    } else {
      throw ApiError.conflict(
        `User "${cleanEmail}" is already a member or has a pending invitation (${existingMember.role}).`,
      );
    }
  } else {
    organization.members.push({
      userId: userToInvite ? userToInvite._id : null,
      email: cleanEmail,
      role,
      status: "pending",
      invitedBy: inviterId,
      joinedAt: new Date(),
    });
  }

  organization.markModified("members");
  await organization.save();

  const updatedOrg = await Organization.findById(id).populate(
    "members.userId",
    "firstName lastName email avatar role",
  );

  const formattedMembers = updatedOrg.members.map((m) => {
    const u =
      typeof m.userId === "object" && m.userId !== null ? m.userId : null;
    return {
      _id: m._id,
      userId: u,
      email: u?.email || m.email || cleanEmail,
      firstName: u?.firstName || "",
      lastName: u?.lastName || "",
      role: m.role || "viewer",
      status: m.status || (u ? "active" : "pending"),
      joinedAt: m.joinedAt,
    };
  });

  logger.info(
    `User ${cleanEmail} invited to org ${organization.name} with role ${role}`,
  );

  return ApiResponse.ok(
    res,
    `Invitation sent to ${cleanEmail} (${role})`,
    formattedMembers,
  );
});

/**
 * DELETE /api/v1/organizations/:id/members/:memberId
 * Remove a member from the organization.
 */
export const removeMember = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?.sub;
  const userEmail = req.user?.email ? req.user.email.toLowerCase() : null;
  const { id, memberId } = req.params;

  const organization = await Organization.findById(id);
  if (!organization) {
    throw ApiError.notFound("Organization not found");
  }

  const isAdminOrOwner = checkUserIsAdminOrOwner(
    organization,
    userId,
    userEmail,
  );

  if (!isAdminOrOwner) {
    throw ApiError.forbidden(
      "Only the organization owner or admin can remove members",
    );
  }

  // Cannot remove owner
  if (
    organization.owner &&
    (organization.owner.toString() === memberId ||
      (req.user?.id &&
        organization.owner.toString() === req.user.id &&
        memberId === req.user.id))
  ) {
    throw ApiError.forbidden("Cannot remove the organization owner");
  }

  organization.members = organization.members.filter(
    (m) =>
      m._id.toString() !== memberId &&
      (m.userId ? m.userId.toString() !== memberId : true),
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
  const userEmail = req.user?.email ? req.user.email.toLowerCase() : null;
  const { id, memberId } = req.params;
  const { role } = req.body;

  const organization = await Organization.findById(id);
  if (!organization) {
    throw ApiError.notFound("Organization not found");
  }

  const isAdminOrOwner = checkUserIsAdminOrOwner(
    organization,
    userId,
    userEmail,
  );

  if (!isAdminOrOwner) {
    throw ApiError.forbidden(
      "Only the organization owner or admin can update member roles",
    );
  }

  const member = organization.members.find(
    (m) =>
      m._id.toString() === memberId ||
      (m.userId && m.userId.toString() === memberId),
  );

  if (!member) {
    throw ApiError.notFound("Member not found in organization");
  }

  if (member.role === "owner") {
    throw ApiError.forbidden(
      "Cannot change the role of the organization owner",
    );
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
  const userEmail = req.user?.email ? req.user.email.toLowerCase() : null;
  const { orgId } = req.params;
  const { name, description, color } = req.body;

  // Verify the user belongs to this organization
  const organization = await Organization.findById(orgId);
  if (!organization) {
    throw ApiError.notFound("Organization not found");
  }

  const isMember = checkUserIsMember(organization, userId, userEmail);

  if (!isMember) {
    throw ApiError.forbidden("You are not a member of this organization");
  }

  let userObj = null;
  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    userObj = await User.findById(userId)
      .lean()
      .catch(() => null);
  }
  if (!userObj && req.user?.email) {
    userObj = await User.findOne({ email: req.user.email.toLowerCase() })
      .lean()
      .catch(() => null);
  }
  if (!userObj && req.user?.sub) {
    userObj = await User.findOne({ cognitoSub: req.user.sub })
      .lean()
      .catch(() => null);
  }

  const creatorEmail = userObj?.email || req.user?.email || "user@lexora.ai";
  const creatorName = userObj
    ? `${userObj.firstName || ""} ${userObj.lastName || ""}`.trim()
    : req.user?.firstName
      ? `${req.user.firstName} ${req.user.lastName || ""}`.trim()
      : "Real User";

  const project = await Project.create({
    name,
    description,
    organizationId: orgId,
    createdBy: userId,
    creatorName,
    creatorEmail,
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
  const userEmail = req.user?.email ? req.user.email.toLowerCase() : null;
  const { orgId } = req.params;

  if (
    !orgId ||
    orgId === "undefined" ||
    orgId === "null" ||
    !mongoose.Types.ObjectId.isValid(orgId)
  ) {
    return ApiResponse.ok(res, "Projects retrieved successfully", []);
  }

  // Verify the user belongs to this organization
  const organization = await Organization.findById(orgId);
  if (!organization) {
    return ApiResponse.ok(res, "Projects retrieved successfully", []);
  }

  const isMember = checkUserIsMember(organization, userId, userEmail);

  if (!isMember) {
    throw ApiError.forbidden("You are not a member of this organization");
  }

  const projects = await Project.find({ organizationId: orgId })
    .populate("createdBy", "firstName lastName email")
    .sort({ createdAt: -1 })
    .lean();

  const normalizedProjects = projects.map((p) => {
    const creatorObj =
      typeof p.createdBy === "object" && p.createdBy !== null
        ? p.createdBy
        : null;
    const creatorName =
      p.creatorName ||
      (creatorObj
        ? `${creatorObj.firstName || ""} ${creatorObj.lastName || ""}`.trim()
        : "Lexora User");
    const creatorEmail =
      p.creatorEmail || creatorObj?.email || "user@lexora.ai";
    return {
      ...p,
      creatorName,
      creatorEmail,
    };
  });

  return ApiResponse.ok(
    res,
    "Projects retrieved successfully",
    normalizedProjects,
  );
});

/**
 * PUT /api/v1/organizations/:orgId/projects/:projectId
 * Update a project.
 */
export const updateProject = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?.sub;
  const userEmail = req.user?.email ? req.user.email.toLowerCase() : null;
  const { orgId, projectId } = req.params;
  const { name, description, status, color } = req.body;

  const organization = await Organization.findById(orgId);
  if (!organization) {
    throw ApiError.notFound("Organization not found");
  }

  const isMember = checkUserIsMember(organization, userId, userEmail);

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

  logger.info(`Project updated: ${project.name} in org ${organization.name}`);

  return ApiResponse.ok(res, "Project updated successfully", project);
});

export const deleteProject = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?.sub;
  const { orgId, projectId } = req.params;

  const organization = await Organization.findById(orgId);
  if (!organization) {
    throw ApiError.notFound("Organization not found");
  }

  const isOwner =
    (organization.owner && organization.owner.toString() === userId) ||
    (req.user?.id &&
      organization.owner &&
      organization.owner.toString() === req.user.id);

  const project = await Project.findOne({
    _id: projectId,
    organizationId: orgId,
  });

  if (!project) {
    throw ApiError.notFound("Project not found");
  }

  const isCreator =
    project.createdBy &&
    (project.createdBy.toString() === userId ||
      (req.user?.id && project.createdBy.toString() === req.user.id));

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
  getMyInvitations,
  acceptInvitation,
  declineInvitation,
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
