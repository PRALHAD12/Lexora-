import mongoose from "mongoose";

const clauseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  riskLevel: {
    type: String,
    enum: ["high", "medium", "safe", "low"],
    default: "safe",
  },
  suggestion: {
    type: String,
    default: "",
  },
});

const contractSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    createdByName: {
      type: String,
      trim: true,
      default: "",
    },
    createdByEmail: {
      type: String,
      trim: true,
      default: "",
    },
    lastUpdatedByName: {
      type: String,
      trim: true,
      default: "",
    },
    lastUpdatedByEmail: {
      type: String,
      trim: true,
      default: "",
    },
    organizationId: {
      type: mongoose.Schema.Types.Mixed,
      ref: "Organization",
      index: true,
      default: null,
    },
    projectId: {
      type: mongoose.Schema.Types.Mixed,
      ref: "Project",
      index: true,
      default: null,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      default: "Untitled Contract",
    },
    fileName: {
      type: String,
      trim: true,
      default: "contract_draft.docx",
    },
    fileType: {
      type: String,
      enum: ["PDF", "DOCX", "TXT", "UNKNOWN", "EDITOR"],
      default: "EDITOR",
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    content: {
      type: String,
      default: "",
    },
    extractedText: {
      type: String,
      default: "",
    },
    clauses: [clauseSchema],
    riskRating: {
      type: String,
      enum: ["High", "Medium", "Low", "Compliant"],
      default: "Compliant",
    },
    flaggedRisksCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["draft", "in_review", "approved", "archived"],
      default: "draft",
    },
    version: {
      type: Number,
      default: 1,
    },
    aiAnalysis: {
      type: String,
      default: "",
    },
    initialPrompt: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

export const Contract = mongoose.model("Contract", contractSchema);
export default Contract;
