import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import asyncHandler from "../../utils/asyncHandler.js";
import ApiResponse from "../../utils/ApiResponse.js";
import ApiError from "../../utils/ApiError.js";
import logger from "../../utils/logger.js";

const router = Router();
router.use(authenticate);

/**
 * POST /api/v1/ai/generate
 * General AI text generation via Python RAG + Ollama.
 * Used as fallback when no contractId is available.
 * Returns an SSE stream so the frontend streamLegalAI() works correctly.
 */
router.post(
  "/generate",
  asyncHandler(async (req, res) => {
    const { prompt } = req.body;

    if (!prompt || !prompt.trim()) {
      throw ApiError.badRequest("Prompt cannot be empty");
    }

    const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || "http://localhost:8000";

    // Call Python service for general Ollama response
    const pyRes = await fetch(`${RAG_SERVICE_URL}/api/rag/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: prompt.trim() }),
    });

    if (!pyRes.ok) {
      throw ApiError.internal("AI service failed to generate a response");
    }

    const pyData = await pyRes.json();
    const answer = pyData?.answer || "I could not generate a response.";

    logger.info(`General AI generate called by user ${req.user?.sub || req.user?.id}`);

    // Return as SSE stream to match what frontend streamLegalAI() expects
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const words = answer.split(" ");
    for (const word of words) {
      res.write(`data: ${JSON.stringify({ chunk: word + " " })}\n\n`);
    }
    res.write("data: [DONE]\n\n");
    res.end();
  })
);

export default router;
