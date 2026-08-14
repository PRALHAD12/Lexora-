import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "archived", "completed"],
      default: "active",
      index: true,
    },
    color: {
      type: String,
      default: "#3B82F6",
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  },
);

// ─── Indexes ──────────────────────────────────────────────────────
projectSchema.index({ organizationId: 1, status: 1 });
projectSchema.index({ createdAt: -1 });

// ─── Static Methods ──────────────────────────────────────────────

/**
 * Find all active projects for an organization.
 */
projectSchema.statics.findByOrganization = function (orgId) {
  return this.find({ organizationId: orgId }).sort({ createdAt: -1 });
};

const Project = mongoose.model("Project", projectSchema);

export default Project;
