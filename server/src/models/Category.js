import mongoose from "mongoose";
import { tenantPlugin } from "../lib/tenantScope.js";

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ["expense", "income"], required: true },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    color: { type: String, default: "#8A8AD9" },
    icon: { type: String, default: "circle" },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true },
);

categorySchema.plugin(tenantPlugin);
categorySchema.index({ userId: 1 });

export default mongoose.model("Category", categorySchema);
