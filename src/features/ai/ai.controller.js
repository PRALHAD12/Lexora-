import { streamLegalAIResponse } from "./ai.service.js";
import logger from "../../utils/logger.js";
import { cacheGet, cacheSet } from "../../utils/cacheService.util.js";
import crypto from "crypto";

/**
 * Controller to handle streaming AI legal responses via Server-Sent Events (SSE)
 * Caches full generated contract analysis outputs into Redis!
 */
export const generateAI = async (req, res, next) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        error: "Prompt parameter is required",
      });
    }

    const cleanPrompt = prompt.trim();
    const promptHash = crypto
      .createHash("md5")
      .update(cleanPrompt)
      .digest("hex");
    const cacheKey = `ai:analysis:${promptHash}`;

    // Set Server-Sent Events (SSE) Headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    // Check if full analysis is cached in Redis
    const cachedAnalysis = await cacheGet(cacheKey);
    if (cachedAnalysis) {
      logger.info(`Serving AI analysis from Redis cache for key [${cacheKey}]`);
      res.write(
        `data: ${JSON.stringify({ chunk: cachedAnalysis, fromCache: true })}\n\n`,
      );
      res.write("data: [DONE]\n\n");
      return res.end();
    }

    let fullAccumulatedResponse = "";

    // Stream text chunks and accumulate response
    await streamLegalAIResponse(cleanPrompt, (chunkText) => {
      fullAccumulatedResponse += chunkText;
      res.write(`data: ${JSON.stringify({ chunk: chunkText })}\n\n`);
    });

    // Save full accumulated AI analysis into Redis for 1 hour (3600s)
    if (fullAccumulatedResponse.trim()) {
      await cacheSet(cacheKey, fullAccumulatedResponse, 3600);
      logger.info(`Cached AI analysis in Redis under key [${cacheKey}]`);
    }

    // Send completion signal
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    logger.error(`Error in generateAI controller: ${error.message}`);
    if (!res.headersSent) {
      next(error);
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
};
