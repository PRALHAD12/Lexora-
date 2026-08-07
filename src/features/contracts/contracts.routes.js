import { Router } from 'express';
import multer from 'multer';
import {
  uploadAndParseContract,
  getAuditHistory,
  getContractById,
  deleteContract,
} from './contracts.controller.js';

// Multer in-memory storage configuration
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB limit
});

const router = Router();

// POST /api/v1/contracts/upload
router.post('/upload', upload.single('contract'), uploadAndParseContract);

// GET /api/v1/contracts/history
router.get('/history', getAuditHistory);

// GET /api/v1/contracts/:id
router.get('/:id', getContractById);

// DELETE /api/v1/contracts/:id
router.delete('/:id', deleteContract);

export default router;
