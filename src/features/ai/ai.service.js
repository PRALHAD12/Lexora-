import { GoogleGenAI } from '@google/genai';

// Helper to get Google GenAI client instance
const getGenAIClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is missing in server environment.');
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * System instruction defining Lexora AI's legal persona & formatting guidelines.
 */
const LEXORA_LEGAL_SYSTEM_INSTRUCTION = `You are Lexora AI, a premier legal contract analyst and legal drafting assistant.
Your goal is to deliver precise, clear, and actionable legal intelligence.

Rules & Guidelines:
1. Tone: Professional, authoritative, and easy to understand for business & legal teams.
2. Formatting: Use Markdown headers (##), bold text, key takeaways, and risk ratings (HIGH RISK 🔴, MEDIUM RISK 🟡, LOW RISK 🟢) when analyzing contracts.
3. Drafting: When requested to draft contracts or clauses (e.g., NDA, MSA, SLA), provide clean, complete, ready-to-use contract text.
4. Disclaimer: Include a brief end note that Lexora AI provides automated legal analysis for workflow efficiency and does not replace formal legal counsel.`;

/**
 * Stream legal AI response using Gemini API with automatic model fallback
 * @param {string} prompt - User legal prompt or query
 * @param {function(string): void} onChunk - Callback called for each stream chunk
 */
export const streamLegalAIResponse = async (prompt, onChunk) => {
  const ai = getGenAIClient();

  // Primary model and fallback models supported by Google AI Studio
  const candidateModels = [
    process.env.GEMINI_MODEL,
    'gemini-flash-latest',
    'gemini-2.0-flash',
    'gemini-pro-latest',
    'gemini-2.5-pro',
  ].filter(Boolean);

  let lastError = null;

  for (const modelName of candidateModels) {
    try {
      const responseStream = await ai.models.generateContentStream({
        model: modelName,
        contents: prompt,
        config: {
          systemInstruction: LEXORA_LEGAL_SYSTEM_INSTRUCTION,
          temperature: 0.2,
        },
      });

      let streamedAny = false;
      for await (const chunk of responseStream) {
        if (chunk.text) {
          streamedAny = true;
          onChunk(chunk.text);
        }
      }

      if (streamedAny) {
        return; // Streamed successfully!
      }
    } catch (err) {
      console.warn(`[Lexora AI] Model '${modelName}' unavailable, trying fallback model...`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error('All Gemini model candidates failed.');
};
