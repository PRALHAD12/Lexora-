import { Router } from "express";
import multer from "multer";
import {
  createContractDraft,
  updateContract,
  listContracts,
  getContractById,
  deleteContract,
  uploadAndParseContract,
  getAuditHistory,
} from "./contracts.controller.js";
import { authenticate } from "../../middleware/authenticate.js";

// Multer in-memory storage configuration
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB limit
});

const router = Router();

// Apply auth to contract routes
router.use(authenticate);

// POST /api/v1/contracts (and /create)
router.post("/", createContractDraft);
router.post("/create", createContractDraft);

// GET /api/v1/contracts
router.get("/", listContracts);

// GET /api/v1/contracts/history
router.get("/history", getAuditHistory);

// POST /api/v1/contracts/upload
router.post("/upload", upload.single("contract"), uploadAndParseContract);

// GET /api/v1/contracts/:id
router.get("/:id", getContractById);

// PUT /api/v1/contracts/:id
router.put("/:id", updateContract);

// DELETE /api/v1/contracts/:id
router.delete("/:id", deleteContract);

export default router;
