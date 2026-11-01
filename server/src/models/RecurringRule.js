import mongoose from "mongoose";
import { tenantPlugin } from "../lib/tenantScope.js";

const recurringRuleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["expense", "income", "transfer"],
      required: true,
    },
    amount: { type: Number, required: true, min: 0.01 },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      default: null,
    },
    fromAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      default: null,
    },
    toAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      default: null,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    subcategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    frequency: {
      type: String,
      enum: ["daily", "weekly", "monthly", "yearly"],
      default: "monthly",
    },
    interval: { type: Number, default: 1, min: 1 },
    nextRunDate: { type: Date, required: true },
    enabled: { type: Boolean, default: true },
    note: { type: String, default: "" },
  },
  { timestamps: true },
);

recurringRuleSchema.plugin(tenantPlugin);
recurringRuleSchema.index({ userId: 1 });

export default mongoose.model("RecurringRule", recurringRuleSchema);
