import mongoose from "mongoose";
import { Contract } from "./Contract.model.js";
import User from "../user/user.model.js";
import Organization from "../organization/Organization.model.js";
import { parseDocumentText } from "../../utils/documentParser.util.js";
import logger from "../../utils/logger.js";
import { cacheGet, cacheSet, cacheDel } from "../../utils/cacheService.util.js";
import ApiResponse from "../../utils/ApiResponse.js";
import ApiError from "../../utils/ApiError.js";
import asyncHandler from "../../utils/asyncHandler.js";

/**
 * Helper to build user query matcher across sub and local id
 */
const buildUserQuery = (req) => {
  const userSub = req.user?.sub;
  const userId = req.user?.id || req.user?._id?.toString();
  const candidates = [userSub, userId].filter(Boolean);
  if (candidates.length === 1) return { userId: candidates[0] };
  return { userId: { $in: candidates } };
};

/**
 * Helper to check user's role in an organization ('owner' | 'admin' | 'editor' | 'viewer' | null)
 */
const getUserOrgRole = async (organizationId, userId, userEmail) => {
  if (!organizationId || !mongoose.Types.ObjectId.isValid(organizationId)) return null;
  const org = await Organization.findById(organizationId).lean();
  if (!org) return null;
  const isOwner =
    (org.owner && org.owner.toString() === userId?.toString()) ||
    (org.owner && org.owner._id && org.owner._id.toString() === userId?.toString());
  if (isOwner) return "owner";

  const cleanEmail = userEmail ? userEmail.toLowerCase() : "";
  const member = org.members?.find((m) => {
    const mUserId = m.userId?._id?.toString() || m.userId?.toString();
    const mEmail = (m.email || (m.userId && typeof m.userId === "object" && m.userId.email)) || "";
    return (
      (mUserId && (mUserId === userId?.toString())) ||
      (cleanEmail && mEmail.toLowerCase() === cleanEmail)
    );
  });

  return member && member.status === "active" ? member.role : null;
};

/**
 * POST /api/v1/contracts/create
 * Create a new contract draft in the editor
 */
export const createContractDraft = asyncHandler(async (req, res) => {
  const userId = req.user?.sub || req.user?.id || req.user?._id || "demo-user";
  
  let userObj = null;
  if (req.user?.id && mongoose.Types.ObjectId.isValid(req.user.id)) {
    userObj = await User.findById(req.user.id).lean().catch(() => null);
  }
  if (!userObj && req.user?.email) {
    userObj = await User.findOne({ email: req.user.email.toLowerCase() }).lean().catch(() => null);
  }
  if (!userObj && req.user?.sub) {
    userObj = await User.findOne({ cognitoSub: req.user.sub }).lean().catch(() => null);
  }

  const userEmail = userObj?.email || req.user?.email || "user@lexora.ai";
  const userName = userObj ? `${userObj.firstName || ''} ${userObj.lastName || ''}`.trim() : (req.user?.firstName ? `${req.user.firstName} ${req.user.lastName || ''}`.trim() : "Real User");
  const { title, content, organizationId, projectId, initialPrompt, clauses, status } = req.body;

  // Check organization permissions
  if (organizationId && organizationId !== "undefined" && organizationId !== "null" && mongoose.Types.ObjectId.isValid(organizationId)) {
    const role = await getUserOrgRole(organizationId, req.user?.id || req.user?.sub, userEmail);
    if (!role) {
      throw ApiError.forbidden("You are not a member of this organization");
    }
    if (role === "viewer") {
      throw ApiError.forbidden("Viewers have read-only access and cannot create contracts");
    }
  }

  const contract = await Contract.create({
    userId,
    creatorName: userName,
    creatorEmail: userEmail,
    createdByName: userName,
    createdByEmail: userEmail,
    lastUpdatedByName: userName,
    lastUpdatedByEmail: userEmail,
    title: title || "Untitled Legal Agreement",
    content: content || "",
    organizationId: organizationId || null,
    projectId: projectId || null,
    initialPrompt: initialPrompt || "",
    clauses: clauses || [],
    status: status || "draft",
    fileType: "EDITOR",
  });

  // Invalidate Redis history cache
  await cacheDel(`contracts:history:${userId}`);

  logger.info(`Contract draft created: "${contract.title}" (ID: ${contract._id}) by ${userName} (${userEmail})`);

  return ApiResponse.created(res, "Contract draft created successfully", contract);
});

/**
 * PUT /api/v1/contracts/:id
 * Update contract title, content, clauses, status, project
 */
export const updateContract = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, content, organizationId, projectId, clauses, status, riskRating, flaggedRisksCount } = req.body;

  if (!id || id === "undefined" || id === "null" || !mongoose.Types.ObjectId.isValid(id)) {
    throw ApiError.notFound("Contract not found");
  }

  const contract = await Contract.findById(id);
  if (!contract) {
    throw ApiError.notFound("Contract not found");
  }

  const reqUserCandidates = [req.user?.sub, req.user?.id, req.user?._id?.toString()].filter(Boolean);
  const targetOrgId = organizationId || contract.organizationId;

  if (targetOrgId) {
    const role = await getUserOrgRole(targetOrgId, req.user?.id || req.user?.sub, req.user?.email);
    if (!role) {
      throw ApiError.forbidden("You do not have access to this organization's contracts");
    }
    if (role === "viewer") {
      throw ApiError.forbidden("Viewers have read-only access and cannot edit contracts");
    }
  } else if (reqUserCandidates.length > 0 && !reqUserCandidates.includes(contract.userId.toString())) {
    throw ApiError.forbidden("You do not have permission to edit this contract");
  }

  if (title !== undefined) contract.title = title;
  if (content !== undefined) contract.content = content;
  if (organizationId !== undefined) contract.organizationId = organizationId || null;
  if (projectId !== undefined) contract.projectId = projectId || null;
  if (clauses !== undefined) contract.clauses = clauses;
  if (status !== undefined) contract.status = status;
  if (riskRating !== undefined) contract.riskRating = riskRating;
  if (flaggedRisksCount !== undefined) contract.flaggedRisksCount = flaggedRisksCount;

  contract.version = (contract.version || 1) + 1;
  await contract.save();

  // Update Redis cache
  await cacheSet(`contract:${contract._id}`, contract, 3600);
  await cacheDel(`contracts:history:${contract.userId}`);

  logger.info(`Contract updated: "${contract.title}" (v${contract.version}) [Project: ${contract.projectId}] by user ${contract.userId}`);

  return ApiResponse.ok(res, "Contract updated successfully", contract);
});

/**
 * GET /api/v1/contracts
 * List all contracts for the current user (optionally filtered by org/project)
 */
export const listContracts = asyncHandler(async (req, res) => {
  const { organizationId, projectId } = req.query;

  const query = { isDeleted: { $ne: true }, status: { $ne: "archived" } };

  if (organizationId && organizationId !== "undefined" && organizationId !== "null" && mongoose.Types.ObjectId.isValid(organizationId)) {
    const role = await getUserOrgRole(organizationId, req.user?.id || req.user?.sub, req.user?.email);
    if (!role) {
      throw ApiError.forbidden("You are not a member of this organization");
    }
    query.organizationId = organizationId;
  } else {
    const userQuery = buildUserQuery(req);
    Object.assign(query, userQuery);
  }

  if (projectId && projectId !== "undefined" && projectId !== "null" && mongoose.Types.ObjectId.isValid(projectId)) {
    query.projectId = projectId;
  }

  const contracts = await Contract.find(query)
    .populate("projectId", "name color status description")
    .populate("organizationId", "name")
    .sort({ updatedAt: -1 })
    .lean();

  return ApiResponse.ok(res, "Contracts retrieved successfully", contracts);
});

/**
 * GET /api/v1/contracts/:id
 * Fetch single contract details by ID
 */
export const getContractById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id || id === "undefined" || id === "null" || !mongoose.Types.ObjectId.isValid(id)) {
    throw ApiError.notFound("Contract not found");
  }

  // Check cache first
  const cached = await cacheGet(`contract:${id}`);
  if (cached) {
    return ApiResponse.ok(res, "Contract retrieved from cache", cached);
  }

  const contract = await Contract.findById(id)
    .populate("projectId", "name color status description")
    .populate("organizationId", "name");

  if (!contract) {
    throw ApiError.notFound("Contract not found");
  }

  // Cache in Redis for 1 hour
  await cacheSet(`contract:${id}`, contract, 3600);

  return ApiResponse.ok(res, "Contract retrieved successfully", contract);
});

/**
 * DELETE /api/v1/contracts/:id
 * Delete a contract record
 */
export const deleteContract = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const contract = await Contract.findById(id);
  if (!contract) {
    throw ApiError.notFound("Contract not found");
  }

  const reqUserCandidates = [req.user?.sub, req.user?.id, req.user?._id?.toString()].filter(Boolean);
  if (reqUserCandidates.length > 0 && !reqUserCandidates.includes(contract.userId.toString())) {
    throw ApiError.forbidden("You do not have permission to delete this contract");
  }

  contract.isDeleted = true;
  contract.status = "archived";
  await contract.save();

  // Invalidate Redis cache
  await cacheDel(`contract:${id}`);
  await cacheDel(`contracts:history:${contract.userId}`);

  logger.info(`Contract soft-deleted/archived: ID ${id}`);

  return ApiResponse.ok(res, "Contract deleted successfully");
});

/**
 * POST /api/v1/contracts/upload
 * Handle multipart document upload, text parsing, and MongoDB persistence
 */
export const uploadAndParseContract = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw ApiError.badRequest("No file uploaded. Please upload a PDF or DOCX contract file.");
  }

  const { originalname, mimetype, size, buffer } = req.file;
  const userId = req.user?.sub || req.user?.id || req.user?._id || "demo-user";

  // Parse contract text
  const extractedText = await parseDocumentText(buffer, mimetype, originalname);

  // Initial Risk Rating heuristic evaluation
  const lowerText = extractedText.toLowerCase();
  let riskRating = "Compliant";
  let flaggedRisksCount = 0;
  let status = "draft";

  if (
    lowerText.includes("indemnify") ||
    lowerText.includes("uncapped") ||
    lowerText.includes("sole discretion")
  ) {
    riskRating = "High";
    flaggedRisksCount = 14;
  } else if (
    lowerText.includes("penalty") ||
    lowerText.includes("termination") ||
    lowerText.includes("breach")
  ) {
    riskRating = "Medium";
    flaggedRisksCount = 6;
  }

  const fileType = originalname.toLowerCase().endsWith(".pdf")
    ? "PDF"
    : originalname.toLowerCase().endsWith(".docx")
      ? "DOCX"
      : "TXT";

  const contract = await Contract.create({
    userId,
    title: originalname.replace(/\.[^/.]+$/, ""),
    fileName: originalname,
    fileType,
    fileSize: size,
    content: extractedText,
    extractedText,
    riskRating,
    flaggedRisksCount,
    status,
    aiAnalysis: `Contract ${originalname} parsed successfully. Identified ${flaggedRisksCount} potential risk areas.`,
  });

  // Cache newly uploaded contract in Redis for 3600s
  await cacheSet(`contract:${contract._id}`, contract, 3600);
  await cacheDel(`contracts:history:${userId}`);

  logger.info(`Contract ${originalname} uploaded and parsed for user ${userId}`);

  return ApiResponse.created(res, "Contract uploaded and parsed successfully", contract);
});

/**
 * GET /api/v1/contracts/history
 * Fetch recent audit history threads for logged-in user
 */
export const getAuditHistory = asyncHandler(async (req, res) => {
  const userQuery = buildUserQuery(req);
  const cacheKey = `contracts:history:${req.user?.sub || req.user?.id}`;

  // Check Redis Cache
  const cachedHistory = await cacheGet(cacheKey);
  if (cachedHistory) {
    return ApiResponse.ok(res, "Audit history retrieved from cache", cachedHistory);
  }

  const contracts = await Contract.find(userQuery)
    .sort({ updatedAt: -1 })
    .limit(20)
    .select("title fileName fileType riskRating flaggedRisksCount status createdAt updatedAt projectId");

  // Cache in Redis for 120 seconds
  await cacheSet(cacheKey, contracts, 120);

  return ApiResponse.ok(res, "Audit history retrieved successfully", contracts);
});

export default {
  createContractDraft,
  updateContract,
  listContracts,
  getContractById,
  deleteContract,
  uploadAndParseContract,
  getAuditHistory,
};
