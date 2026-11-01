import mongoose from "mongoose";
import { tenantPlugin } from "../lib/tenantScope.js";

const accountSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["bank", "cash", "credit_card", "investment", "other"],
      default: "bank",
    },
    color: { type: String, default: "#5B5BD6" },
    logo: { type: String, default: "" },
    balanceAdjustment: { type: Number, default: 0 },
    creditLimit: { type: Number, default: null },
    dueDate: { type: Number, default: null },
    billingDate: { type: Number, default: null },
    paymentAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      default: null,
    },
    autoPayEnabled: { type: Boolean, default: false },
    autoPayEnabledAt: { type: Date, default: null },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true },
);

accountSchema.plugin(tenantPlugin);
accountSchema.index({ userId: 1 });

export default mongoose.model("Account", accountSchema);
