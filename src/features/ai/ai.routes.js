import { Router } from 'express';
import { generateLegalAI } from './ai.controller.js';

const router = Router();

/**
 * POST /api/v1/ai/generate
 * Accepts JSON body: { prompt: "Legal query..." }
 * Returns Server-Sent Events (SSE) stream of text chunks
 */
router.post('/generate', generateLegalAI);

export default router;
