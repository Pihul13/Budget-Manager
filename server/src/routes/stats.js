import express from "express";
import Transaction from "../models/Transaction.js";
import Account from "../models/Account.js";
import { monthBounds, accountDelta } from "./helpers.js";

const router = express.Router();

router.get("/month/:month", async (req, res) => {
  try {
    const { start, end } = monthBounds(req.params.month);
    const txns = await Transaction.find({ date: { $gte: start, $lt: end } })
      .populate("categoryId subcategoryId accountId fromAccountId toAccountId")
      .lean();
    const income = txns
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + t.amount, 0);
    const expense = txns
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + t.amount, 0);
    const byCategory = {};
    for (const t of txns.filter((t) => t.type === "expense")) {
      const name = t.categoryId?.name || "Uncategorized";
      byCategory[name] = (byCategory[name] || 0) + t.amount;
    }
    const byDay = [];
    const daysInMonth = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
    ).getUTCDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const day = `${d}`;
      const sameDay = txns.filter((t) => new Date(t.date).getUTCDate() === d);
      byDay.push({
        day,
        income: sameDay
          .filter((t) => t.type === "income")
          .reduce((s, t) => s + t.amount, 0),
        expense: sameDay
          .filter((t) => t.type === "expense")
          .reduce((s, t) => s + t.amount, 0),
      });
    }
    const accounts = await Account.find({ archived: false }).lean();
    const allTxns = await Transaction.find().lean();
    const accountBalances = accounts.map((a) => ({
      ...a,
      balance:
        a.type === "credit_card"
          ? -Math.max(
              0,
              -allTxns.reduce((sum, t) => sum + accountDelta(t, a._id), 0),
            )
          : (a.balanceAdjustment || 0) +
            allTxns.reduce((sum, t) => sum + accountDelta(t, a._id), 0),
    }));
    const assets = accountBalances
      .filter((a) => a.type !== "credit_card")
      .reduce((s, a) => s + a.balance, 0);
    const liabilities = accountBalances
      .filter((a) => a.type === "credit_card")
      .reduce((s, a) => s + Math.max(0, -a.balance), 0);
    res.json({
      income,
      expense,
      savings: income - expense,
      byCategory,
      byDay,
      assets,
      liabilities,
      netWorth: assets - liabilities,
      accountBalances,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/history", async (req, res) => {
  try {
    const [years = 1] = [Number(req.query.years || 1)];
    const now = new Date();
    const rows = [];
    for (let i = years * 12 - 1; i >= 0; i--) {
      const d = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
      );
      const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const { start, end } = monthBounds(month);
      const txns = await Transaction.find({
        date: { $gte: start, $lt: end },
      }).lean();
      rows.push({
        month,
        income: txns
          .filter((t) => t.type === "income")
          .reduce((s, t) => s + t.amount, 0),
        expense: txns
          .filter((t) => t.type === "expense")
          .reduce((s, t) => s + t.amount, 0),
      });
    }
    const allTxns = await Transaction.find().lean();
    const accounts = await Account.find({ archived: false }).lean();
    const balance = (account) =>
      (account.type === "credit_card" ? 0 : account.balanceAdjustment || 0) +
      allTxns.reduce((s, t) => s + accountDelta(t, account._id), 0);
    const assets = accounts
      .filter((a) => a.type !== "credit_card")
      .reduce((s, a) => s + balance(a), 0);
    const liabilities = accounts
      .filter((a) => a.type === "credit_card")
      .reduce((s, a) => s + Math.max(0, -balance(a)), 0);
    res.json({ monthly: rows, currentNetWorth: assets - liabilities });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
