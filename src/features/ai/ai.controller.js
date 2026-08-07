import { streamLegalAIResponse } from './ai.service.js';

/**
 * Express Controller: Handle legal prompt queries with real-time SSE streaming
 */
export const generateLegalAI = async (req, res, next) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Prompt string is required.',
      });
    }

    // Configure headers for real-time Server-Sent Events (SSE) streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    // Stream chunks back to client as they arrive from Gemini
    await streamLegalAIResponse(prompt.trim(), (chunkText) => {
      res.write(`data: ${JSON.stringify({ chunk: chunkText })}\n\n`);
    });

    // Send closing SSE signal
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('[Lexora AI Controller Error]:', error);

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: error.message || 'Internal AI service error',
      });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
};
