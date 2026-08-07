import mammoth from "mammoth";
import logger from "./logger.js";

/**
 * Extracts raw plain text from PDF, DOCX, or TXT file buffers
 * @param {Buffer} buffer File buffer
 * @param {string} mimeType MIME type of the file
 * @param {string} originalName Original file name
 * @returns {Promise<string>} Extracted plain text
 */
export async function parseDocumentText(buffer, mimeType, originalName = "") {
  try {
    const fileName = originalName.toLowerCase();

    if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) {
      const pdfParseModule = await import("pdf-parse/lib/pdf-parse.js");
      const pdfParse = pdfParseModule.default || pdfParseModule;
      const pdfData = await pdfParse(buffer);
      return pdfData.text || "";
    }

    if (
      mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      fileName.endsWith(".docx")
    ) {
      const docxResult = await mammoth.extractRawText({ buffer });
      return docxResult.value || "";
    }

    // Default plain text fallback
    return buffer.toString("utf-8");
  } catch (error) {
    logger.error(
      `Error parsing document text (${originalName}): ${error.message}`,
    );
    return buffer.toString("utf-8");
  }
}
