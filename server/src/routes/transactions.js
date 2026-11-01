import express from "express";
import Transaction from "../models/Transaction.js";
import Account from "../models/Account.js";
import Fund from "../models/Fund.js";
import SavingGoal from "../models/SavingGoal.js";
import { earmarkDelta } from "./helpers.js";

const router = express.Router();
const populatedFields =
  "accountId fromAccountId toAccountId categoryId subcategoryId goalId fundId fromFundId fromGoalId toFundId toGoalId recurringRuleId";

async function taggedEntries(query, excludeId) {
  if (excludeId) query._id = { $ne: excludeId };
  return Transaction.find(query).lean();
}

function bucketBalance(entries, kind, bucketId, accountId) {
  return entries.reduce(
    (balance, entry) =>
      balance + earmarkDelta(entry, kind, bucketId, accountId),
    0,
  );
}

function bucketEntriesQuery(kind, bucketId) {
  const fields =
    kind === "fund"
      ? ["fundId", "fromFundId", "toFundId"]
      : ["goalId", "fromGoalId", "toGoalId"];
  return {
    type: { $in: ["transfer", "expense", "reallocation"] },
    $or: fields.map((field) => ({ [field]: bucketId })),
  };
}

async function validateTaggedExpense(data, excludeId) {
  if (data.fundId && data.goalId)
    throw new Error("An expense can be tagged to a goal or a fund, not both.");
  if (data.fundId) {
    if (data.fundAction && data.fundAction !== "withdrawal")
      throw new Error("Spending from a fund must be a withdrawal.");
    if (!(await Fund.exists({ _id: data.fundId, archived: false })))
      throw new Error("Fund not found.");
    data.fundAction = "withdrawal";
    const entries = await taggedEntries(
      bucketEntriesQuery("fund", data.fundId),
      excludeId,
    );
    if (bucketBalance(entries, "fund", data.fundId, data.accountId) < data.amount)
      throw new Error("Spending exceeds the available fund balance in this account.");
  } else if (data.goalId) {
    if (!(await SavingGoal.exists({ _id: data.goalId, archived: false })))
      throw new Error("Goal not found.");
    const entries = await taggedEntries(
      bucketEntriesQuery("goal", data.goalId),
      excludeId,
    );
    if (bucketBalance(entries, "goal", data.goalId, data.accountId) < data.amount)
      throw new Error("Spending exceeds the available goal balance in this account.");
  }
  data.fundAction = data.fundId ? "withdrawal" : null;
  if ((data.fundId || data.goalId) && !data.paidTo?.trim())
    throw new Error("Enter who the money was paid to.");
}

async function validateTransaction(data, excludeId) {
  if (data.type === "reallocation") {
    const sources = [data.fromFundId, data.fromGoalId].filter(Boolean);
    const destinations = [data.toFundId, data.toGoalId].filter(Boolean);
    if (sources.length !== 1 || destinations.length !== 1)
      throw new Error("Choose one source and one destination fund or goal.");
    if (!data.accountId)
      throw new Error("Select the account holding the earmarked money.");
    if (!(await Account.exists({ _id: data.accountId, archived: false })))
      throw new Error("Account not found.");
    const fromKind = data.fromFundId ? "fund" : "goal";
    const toKind = data.toFundId ? "fund" : "goal";
    const fromId = data.fromFundId || data.fromGoalId;
    const toId = data.toFundId || data.toGoalId;
    if (fromKind === toKind && String(fromId) === String(toId))
      throw new Error("Choose a different destination.");
    const [sourceExists, destinationExists] = await Promise.all([
      fromKind === "fund"
        ? Fund.exists({ _id: fromId, archived: false })
        : SavingGoal.exists({ _id: fromId, archived: false }),
      toKind === "fund"
        ? Fund.exists({ _id: toId, archived: false })
        : SavingGoal.exists({ _id: toId, archived: false }),
    ]);
    if (!sourceExists || !destinationExists)
      throw new Error("Source or destination fund/goal not found.");
    const query = bucketEntriesQuery(fromKind, fromId);
    if (excludeId) query._id = { $ne: excludeId };
    const entries = await Transaction.find(query).lean();
    if (bucketBalance(entries, fromKind, fromId, data.accountId) < data.amount)
      throw new Error("Reallocation exceeds the available balance in this account.");
    data.fromFundId = fromKind === "fund" ? fromId : null;
    data.fromGoalId = fromKind === "goal" ? fromId : null;
    data.toFundId = toKind === "fund" ? toId : null;
    data.toGoalId = toKind === "goal" ? toId : null;
    data.fundId = null;
    data.goalId = null;
    data.fundAction = null;
    data.fromAccountId = null;
    data.toAccountId = null;
    data.categoryId = null;
    data.subcategoryId = null;
    data.paidTo = "";
    return;
  }
  data.fromFundId = null;
  data.fromGoalId = null;
  data.toFundId = null;
  data.toGoalId = null;
  if (data.type === "expense") {
    if (!data.accountId) throw new Error("Account is required.");
    await validateTaggedExpense(data, excludeId);
    return;
  }
  if (data.type === "income") {
    if (data.fundId || data.goalId || data.fundAction)
      throw new Error(
        "Funds and goals can only be tagged to expenses or transfers.",
      );
    if (!data.accountId) throw new Error("Account is required.");
    data.fundAction = null;
    return;
  }
  if (data.type !== "transfer")
    throw new Error("Invalid transaction type.");
  if (!data.fromAccountId || !data.toAccountId)
    throw new Error("Both transfer accounts are required.");
  if (String(data.fromAccountId) === String(data.toAccountId))
    throw new Error("Transfer accounts must be different.");
  if (data.fundId && data.goalId)
    throw new Error("A transfer can be tagged to a goal or a fund, not both.");
  if (data.fundId) {
    if (!data.fundAction)
      throw new Error(
        "Choose whether this transfer adds to or withdraws from the fund.",
      );
    if (!(await Fund.exists({ _id: data.fundId, archived: false })))
      throw new Error("Fund not found.");
    if (data.fundAction === "withdrawal") {
      const entries = await taggedEntries(
        bucketEntriesQuery("fund", data.fundId),
        excludeId,
      );
      if (bucketBalance(entries, "fund", data.fundId, data.fromAccountId) < data.amount)
        throw new Error(
          "Withdrawal exceeds the available fund balance in this account.",
        );
    }
  } else {
    if (data.fundAction)
      throw new Error("Select a fund for this fund action.");
    if (data.goalId && !(await SavingGoal.exists({ _id: data.goalId, archived: false })))
      throw new Error("Goal not found.");
    data.fundAction = null;
  }
}

router.get("/", async (req, res) => {
  try {
    const { from, to, limit = 200 } = req.query;
    const q = {};
    if (from || to) q.date = {};
    if (from) q.date.$gte = new Date(from);
    if (to) q.date.$lt = new Date(to);
    const rows = await Transaction.find(q)
      .populate(populatedFields)
      .sort({ date: -1, createdAt: -1 })
      .limit(Number(limit));
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const data = {
      ...req.body,
      amount: Number(req.body.amount),
      date: new Date(req.body.date),
    };
    await validateTransaction(data);
    const txn = await Transaction.create(data);
    const populated = await Transaction.findById(txn._id).populate(populatedFields);
    res.status(201).json(populated);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const existing = await Transaction.findById(req.params.id).select(
      "autoPaymentKey",
    );
    if (existing?.autoPaymentKey)
      return res.status(409).json({
        error: "Automatic credit-card payments cannot be edited.",
      });
    const data = {
      ...req.body,
      amount: Number(req.body.amount),
      date: new Date(req.body.date),
    };
    await validateTransaction(data, req.params.id);
    const txn = await Transaction.findByIdAndUpdate(
      req.params.id,
      data,
      { new: true, runValidators: true },
    ).populate(populatedFields);
    res.json(txn);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const existing = await Transaction.findById(req.params.id).select(
      "autoPaymentKey",
    );
    if (existing?.autoPaymentKey)
      return res.status(409).json({
        error: "Automatic credit-card payments cannot be deleted.",
      });
    await Transaction.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
