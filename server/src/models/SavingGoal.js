import mongoose from "mongoose";
import { tenantPlugin } from "../lib/tenantScope.js";

const savingGoalSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    targetAmount: { type: Number, required: true, min: 0.01 },
    targetDate: { type: Date, default: null },
    color: { type: String, default: "#7C68EE" },
    icon: { type: String, default: "target" },
    holdingAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      default: null,
    },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true },
);

savingGoalSchema.plugin(tenantPlugin);
savingGoalSchema.index({ userId: 1 });

export default mongoose.model("SavingGoal", savingGoalSchema);
