import { streamLegalAIResponse } from "./ai.service.js";
import logger from "../../utils/logger.js";

/**
 * Controller to handle streaming AI legal responses via Server-Sent Events (SSE)
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

    // Set Server-Sent Events (SSE) Headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable Nginx buffering if proxied

    // Stream text chunks
    await streamLegalAIResponse(prompt.trim(), (chunkText) => {
      res.write(`data: ${JSON.stringify({ chunk: chunkText })}\n\n`);
    });

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
