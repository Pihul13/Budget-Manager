import mongoose from "mongoose";
import { tenantPlugin } from "../lib/tenantScope.js";

const settingsSchema = new mongoose.Schema(
  {
    displayName: { type: String, trim: true, maxlength: 40, default: "" },
    theme: {
      type: String,
      enum: ["light", "dark", "system"],
      default: "light",
    },
    firstDayOfMonth: { type: Number, default: 1 },
    retentionMonths: { type: Number, default: 0 },
  },
  { timestamps: true },
);

settingsSchema.plugin(tenantPlugin);
settingsSchema.index({ userId: 1 }, { unique: true });

export default mongoose.model("Settings", settingsSchema);
