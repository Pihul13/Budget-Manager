import express from "express";
import Account from "../models/Account.js";
import Category from "../models/Category.js";
import Transaction from "../models/Transaction.js";
import Budget from "../models/Budget.js";
import SavingGoal from "../models/SavingGoal.js";
import RecurringRule from "../models/RecurringRule.js";
import Settings from "../models/Settings.js";
import Fund from "../models/Fund.js";
import { currentUserId } from "../lib/tenantScope.js";

const router = express.Router();
const models = {
  accounts: Account,
  categories: Category,
  transactions: Transaction,
  budgets: Budget,
  goals: SavingGoal,
  recurring: RecurringRule,
  settings: Settings,
  funds: Fund,
};

router.get("/export", async (req, res) => {
  try {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {},
    };
    for (const [key, Model] of Object.entries(models))
      payload.data[key] = await Model.find().lean();
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="personal-finance-backup.json"',
    );
    res.json(payload);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/import", async (req, res) => {
  try {
    const payload = req.body;
    if (
      payload?.version !== 1 ||
      !payload.data ||
      typeof payload.data !== "object" ||
      Array.isArray(payload.data) ||
      Object.keys(payload.data).length !== Object.keys(models).length ||
      Object.keys(models).some((key) => !Array.isArray(payload.data[key])) ||
      Object.values(payload.data).some((rows) => !Array.isArray(rows))
    )
      return res.status(400).json({ error: "Invalid backup file." });
    const userId = currentUserId();
    for (const [key, Model] of Object.entries(models)) {
      if (!(key in payload.data)) continue;
      await Model.deleteMany({});
      if (payload.data[key].length) {
        const rows = payload.data[key].map((row) => ({
          ...row,
          userId,
        }));
        await Model.insertMany(rows, { ordered: false });
      }
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
