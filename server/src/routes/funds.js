import express from "express";
import Fund from "../models/Fund.js";
import Transaction from "../models/Transaction.js";
import { earmarkDelta } from "./helpers.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const [funds, entries] = await Promise.all([
      Fund.find({ archived: false }).sort({ createdAt: 1 }).lean(),
      Transaction.find({
        type: { $in: ["transfer", "expense", "reallocation"] },
        $or: [
          { fundId: { $ne: null } },
          { fromFundId: { $ne: null } },
          { toFundId: { $ne: null } },
        ],
      })
        .populate("accountId fromAccountId toAccountId")
        .lean(),
    ]);
    res.json(
      funds.map((fund) => {
        const fundEntries = entries.filter(
          (entry) =>
            String(entry.fundId) === String(fund._id) ||
            String(entry.fromFundId) === String(fund._id) ||
            String(entry.toFundId) === String(fund._id),
        );
        const balancesByAccount = new Map();
        let balance = 0;
        for (const entry of fundEntries) {
          const account =
            entry.type === "reallocation"
              ? entry.accountId
              : entry.type === "expense"
              ? entry.accountId
              : entry.fundAction === "withdrawal"
                ? entry.fromAccountId
                : entry.toAccountId;
          if (!account?._id) continue;

          const accountId = String(account._id);
          const current = balancesByAccount.get(accountId) || {
            accountId,
            accountName: account.name,
            amount: 0,
          };
          current.amount += earmarkDelta(
            entry,
            "fund",
            fund._id,
            account._id,
          );
          balance += earmarkDelta(entry, "fund", fund._id, account._id);
          balancesByAccount.set(accountId, current);
        }

        return {
          ...fund,
          balance,
          storageByAccount: [...balancesByAccount.values()]
            .filter((account) => account.amount > 0)
            .sort((a, b) => b.amount - a.amount),
        };
      }),
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/:id/history", async (req, res) => {
  try {
    res.json(
      await Transaction.find({
        $or: [
          { fundId: req.params.id },
          { fromFundId: req.params.id },
          { toFundId: req.params.id },
        ],
      })
        .populate(
          "accountId fromAccountId toAccountId fromFundId fromGoalId toFundId toGoalId",
        )
        .sort({ date: -1, createdAt: -1 }),
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/", async (req, res) => {
  try {
    res.status(201).json(await Fund.create(req.body));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    res.json(
      await Fund.findByIdAndUpdate(
        req.params.id,
        { name: req.body.name, color: req.body.color },
        { new: true, runValidators: true },
      ),
    );
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const count = await Transaction.countDocuments({
      $or: [
        { fundId: req.params.id },
        { fromFundId: req.params.id },
        { toFundId: req.params.id },
      ],
    });
    if (count > 0)
      return res.status(409).json({
        error: "Fund has transaction history and cannot be deleted.",
      });
    await Fund.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
