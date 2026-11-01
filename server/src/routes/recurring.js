import express from "express";
import RecurringRule from "../models/RecurringRule.js";
import Transaction from "../models/Transaction.js";
import { addFrequency } from "./helpers.js";

const router = express.Router();
const normalizeIds = (body) => {
  const normalized = { ...body };
  for (const field of [
    "accountId",
    "fromAccountId",
    "toAccountId",
    "categoryId",
    "subcategoryId",
  ]) {
    if (normalized[field] === "") normalized[field] = null;
  }
  return normalized;
};

router.get("/", async (req, res) => {
  try {
    res.json(
      await RecurringRule.find()
        .populate(
          "accountId fromAccountId toAccountId categoryId subcategoryId",
        )
        .sort({ enabled: -1, nextRunDate: 1 }),
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/", async (req, res) => {
  try {
    res.status(201).json(await RecurringRule.create(normalizeIds(req.body)));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    res.json(
      await RecurringRule.findByIdAndUpdate(
        req.params.id,
        normalizeIds(req.body),
        {
          new: true,
          runValidators: true,
        },
      ),
    );
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/:id/execute", async (req, res) => {
  try {
    const rule = await RecurringRule.findById(req.params.id);
    if (!rule) return res.status(404).json({ error: "Rule not found." });
    const txn = await Transaction.create({
      type: rule.type,
      amount: rule.amount,
      accountId: rule.accountId,
      fromAccountId: rule.fromAccountId,
      toAccountId: rule.toAccountId,
      categoryId: rule.categoryId,
      subcategoryId: rule.subcategoryId,
      description: rule.name,
      note: rule.note,
      date: new Date(),
      recurringRuleId: rule._id,
    });
    rule.nextRunDate = addFrequency(
      rule.nextRunDate,
      rule.frequency,
      rule.interval,
    );
    await rule.save();
    res
      .status(201)
      .json(
        await txn.populate(
          "accountId fromAccountId toAccountId categoryId subcategoryId",
        ),
      );
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/:id/skip", async (req, res) => {
  try {
    const rule = await RecurringRule.findById(req.params.id);
    if (!rule) return res.status(404).json({ error: "Rule not found." });
    rule.nextRunDate = addFrequency(
      rule.nextRunDate,
      rule.frequency,
      rule.interval,
    );
    await rule.save();
    res.json(rule);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await RecurringRule.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
