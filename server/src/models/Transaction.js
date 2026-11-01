import mongoose from "mongoose";
import { tenantPlugin } from "../lib/tenantScope.js";

const transactionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["expense", "income", "transfer", "reallocation"],
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
    goalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SavingGoal",
      default: null,
    },
    fromFundId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Fund",
      default: null,
    },
    fromGoalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SavingGoal",
      default: null,
    },
    toFundId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Fund",
      default: null,
    },
    toGoalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SavingGoal",
      default: null,
    },
    fundId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Fund",
      default: null,
    },
    fundAction: {
      type: String,
      enum: ["contribution", "withdrawal"],
      default: null,
      required: function () {
        return Boolean(this.fundId);
      },
    },
    paidTo: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
    note: { type: String, trim: true, default: "" },
    date: { type: Date, required: true },
    recurringRuleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RecurringRule",
      default: null,
    },
    autoPaymentKey: { type: String, default: undefined },
  },
  { timestamps: true },
);

transactionSchema.index({ date: -1 });
transactionSchema.index({ type: 1, date: -1 });
transactionSchema.plugin(tenantPlugin);
transactionSchema.index({ userId: 1 });
transactionSchema.index({ userId: 1, date: -1 });
transactionSchema.index({ userId: 1, type: 1, date: -1 });
transactionSchema.index(
  { userId: 1, autoPaymentKey: 1 },
  { unique: true, partialFilterExpression: { autoPaymentKey: { $exists: true } } },
);

export default mongoose.model("Transaction", transactionSchema);
