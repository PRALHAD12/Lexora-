import { Contract } from "./Contract.model.js";
import { parseDocumentText } from "../../utils/documentParser.util.js";
import logger from "../../utils/logger.js";
import { cacheGet, cacheSet, cacheDel } from "../../utils/cacheService.util.js";

/**
 * Handle multipart document upload, text parsing, and MongoDB persistence
 */
export const uploadAndParseContract = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded. Please upload a PDF or DOCX contract file.",
      });
    }

    const { originalname, mimetype, size, buffer } = req.file;
    const userId = req.user?.sub || req.user?.id || "demo-user-123";

    // Parse contract text
    const extractedText = await parseDocumentText(
      buffer,
      mimetype,
      originalname,
    );

    // Initial Risk Rating heuristic evaluation
    const lowerText = extractedText.toLowerCase();
    let riskRating = "Compliant";
    let flaggedRisksCount = 0;
    let status = "Verified";

    if (
      lowerText.includes("indemnify") ||
      lowerText.includes("uncapped") ||
      lowerText.includes("sole discretion")
    ) {
      riskRating = "High";
      flaggedRisksCount = 14;
      status = "Flagged (14 Risks)";
    } else if (
      lowerText.includes("penalty") ||
      lowerText.includes("termination") ||
      lowerText.includes("breach")
    ) {
      riskRating = "Medium";
      flaggedRisksCount = 6;
      status = "Needs Review";
    }

    const fileType = originalname.toLowerCase().endsWith(".pdf")
      ? "PDF"
      : originalname.toLowerCase().endsWith(".docx")
        ? "DOCX"
        : "TXT";

    const contract = await Contract.create({
      userId,
      fileName: originalname,
      fileType,
      fileSize: size,
      extractedText,
      riskRating,
      flaggedRisksCount,
      status,
      aiAnalysis: `Contract ${originalname} parsed successfully. Identified ${flaggedRisksCount} potential risk areas.`,
    });

    // Cache newly uploaded contract in Redis for 3600s
    await cacheSet(`contract:${contract._id}`, contract, 3600);

    // Invalidate Redis caches for history & stats
    await cacheDel(`contracts:history:${userId}`);
    await cacheDel(`dashboard:stats:${userId}`);

    logger.info(
      `Contract ${originalname} uploaded and parsed for user ${userId}`,
    );

    res.status(201).json({
      success: true,
      message: "Contract uploaded and parsed successfully",
      data: contract,
    });
  } catch (error) {
    logger.error(`Error in uploadAndParseContract: ${error.message}`);
    next(error);
  }
};

/**
 * Fetch recent audit history threads for logged-in user (Cached in Redis for 120s)
 */
export const getAuditHistory = async (req, res, next) => {
  try {
    const userId = req.user?.sub || req.user?.id || "demo-user-123";
    const cacheKey = `contracts:history:${userId}`;

    // Check Redis Cache
    const cachedHistory = await cacheGet(cacheKey);
    if (cachedHistory) {
      return res.status(200).json({
        success: true,
        count: cachedHistory.length,
        data: cachedHistory,
        fromCache: true,
      });
    }

    const contracts = await Contract.find({ userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .select(
        "fileName fileType riskRating flaggedRisksCount status createdAt",
      );

    // Cache in Redis for 120 seconds
    await cacheSet(cacheKey, contracts, 120);

    res.status(200).json({
      success: true,
      count: contracts.length,
      data: contracts,
    });
  } catch (error) {
    logger.error(`Error in getAuditHistory: ${error.message}`);
    next(error);
  }
};

/**
 * Fetch single contract details by ID
 */
export const getContractById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const contract = await Contract.findById(id);

    if (!contract) {
      return res.status(404).json({
        success: false,
        error: "Contract not found",
      });
    }

    res.status(200).json({
      success: true,
      data: contract,
    });
  } catch (error) {
    logger.error(`Error in getContractById: ${error.message}`);
    next(error);
  }
};

/**
 * Delete a contract record
 */
export const deleteContract = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?.sub || req.user?.id || "demo-user-123";

    await Contract.findByIdAndDelete(id);

    // Invalidate Redis caches
    await cacheDel(`contracts:history:${userId}`);
    await cacheDel(`dashboard:stats:${userId}`);

    res.status(200).json({
      success: true,
      message: "Contract deleted successfully",
    });
  } catch (error) {
    logger.error(`Error in deleteContract: ${error.message}`);
    next(error);
  }
};
