import mongoose from "mongoose";
import { tenantPlugin } from "../lib/tenantScope.js";

const fundSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    color: { type: String, default: "#6D63D9" },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true },
);

fundSchema.plugin(tenantPlugin);
fundSchema.index({ userId: 1 });

export default mongoose.model("Fund", fundSchema);
