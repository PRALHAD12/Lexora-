import mongoose from "mongoose";

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      maxlength: 500,
      default: "",
    },
    industry: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    members: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        role: {
          type: String,
          enum: ["owner", "admin", "editor", "viewer"],
          default: "viewer",
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    logo: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
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

// ─── Virtuals ─────────────────────────────────────────────────────
organizationSchema.virtual("memberCount").get(function () {
  return this.members ? this.members.length : 0;
});

// ─── Indexes ──────────────────────────────────────────────────────
organizationSchema.index({ owner: 1, isActive: 1 });
organizationSchema.index({ "members.userId": 1 });
organizationSchema.index({ createdAt: -1 });

// ─── Pre-save: Auto-generate slug ────────────────────────────────
organizationSchema.pre("save", function (next) {
  if (this.isModified("name") || !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    // Add a short random suffix to ensure uniqueness
    this.slug += `-${Date.now().toString(36).slice(-4)}`;
  }
  next();
});

// ─── Static Methods ──────────────────────────────────────────────

/**
 * Find all organizations a user belongs to (as owner or member).
 */
organizationSchema.statics.findByUser = function (userId) {
  return this.find({
    $or: [{ owner: userId }, { "members.userId": userId }],
    isActive: true,
  }).sort({ createdAt: -1 });
};

const Organization = mongoose.model("Organization", organizationSchema);

export default Organization;
