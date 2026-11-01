import express from "express";
import SavingGoal from "../models/SavingGoal.js";
import Transaction from "../models/Transaction.js";
import { earmarkDelta } from "./helpers.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const goals = await SavingGoal.find({ archived: false })
      .sort({ createdAt: 1 })
      .populate("holdingAccountId")
      .lean();
    const entries = await Transaction.find({
      type: { $in: ["transfer", "expense", "reallocation"] },
      $or: [
        { goalId: { $ne: null } },
        { fromGoalId: { $ne: null } },
        { toGoalId: { $ne: null } },
      ],
    })
      .populate("accountId toAccountId")
      .lean();
    const result = goals.map((g) => {
      const goalEntries = entries.filter(
        (entry) =>
          String(entry.goalId) === String(g._id) ||
          String(entry.fromGoalId) === String(g._id) ||
          String(entry.toGoalId) === String(g._id),
      );
      const saved = Math.max(
        0,
        goalEntries.reduce(
          (sum, entry) =>
            sum +
              earmarkDelta(
                entry,
                "goal",
                g._id,
                entry.accountId?._id ||
                  entry.accountId ||
                  entry.toAccountId?._id ||
                  entry.toAccountId,
              ),
          0,
        ),
      );
      const balancesByAccount = new Map();
      for (const entry of goalEntries) {
        const account =
          entry.type === "transfer" ? entry.toAccountId : entry.accountId;
        if (!account?._id) continue;
        const id = String(account._id);
        balancesByAccount.set(
          id,
          {
            accountId: id,
            accountName: account.name,
            amount:
              (balancesByAccount.get(id)?.amount || 0) +
              earmarkDelta(entry, "goal", g._id, id),
          },
        );
      }
      const remaining = Math.max(0, g.targetAmount - saved);
      const progress = g.targetAmount
        ? Math.min(100, (saved / g.targetAmount) * 100)
        : 0;
      return {
        ...g,
        saved,
        remaining,
        progress,
        storageByAccount: [...balancesByAccount.values()]
          .filter((account) => account.amount > 0)
          .sort((a, b) => b.amount - a.amount),
      };
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/:id/history", async (req, res) => {
  try {
    res.json(
      await Transaction.find({
        $or: [
          { goalId: req.params.id },
          { fromGoalId: req.params.id },
          { toGoalId: req.params.id },
        ],
      })
        .populate(
          "accountId fromAccountId toAccountId fromFundId fromGoalId toFundId toGoalId",
        )
        .sort({ date: -1 }),
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/", async (req, res) => {
  try {
    res.status(201).json(await SavingGoal.create(req.body));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    res.json(
      await SavingGoal.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      }),
    );
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const tagged = await Transaction.countDocuments({
      $or: [
        { goalId: req.params.id },
        { fromGoalId: req.params.id },
        { toGoalId: req.params.id },
      ],
    });
    if (tagged > 0)
      return res
        .status(409)
        .json({ error: "Goal has contribution history. Archive it instead." });
    await SavingGoal.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
