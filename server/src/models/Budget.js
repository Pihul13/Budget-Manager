import mongoose from "mongoose";
import { tenantPlugin } from "../lib/tenantScope.js";

const budgetSchema = new mongoose.Schema(
  {
    month: { type: String, required: true },
    totalLimit: { type: Number, default: 0 },
    categoryLimits: [
      {
        categoryId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Category",
          required: true,
        },
        amount: { type: Number, required: true, min: 0 },
      },
    ],
    subcategoryLimits: [
      {
        categoryId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Category",
          required: true,
        },
        subcategoryId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Category",
          required: true,
        },
        amount: { type: Number, required: true, min: 0 },
      },
    ],
  },
  { timestamps: true },
);

budgetSchema.plugin(tenantPlugin);
budgetSchema.index({ userId: 1, month: 1 }, { unique: true });

export default mongoose.model("Budget", budgetSchema);
