import mongoose from "mongoose";

const contractSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    fileType: {
      type: String,
      enum: ["PDF", "DOCX", "TXT", "UNKNOWN"],
      default: "PDF",
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    extractedText: {
      type: String,
      default: "",
    },
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
      default: "Verified",
    },
    aiAnalysis: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

export const Contract = mongoose.model("Contract", contractSchema);
