import express from "express";
import Account from "../models/Account.js";
import Transaction from "../models/Transaction.js";
import { accountDelta, creditCardStatement } from "./helpers.js";
import { processDueCreditCardPayments } from "../services/creditCardAutoPay.js";

const router = express.Router();

function validateLogo(logo) {
  if (logo == null || logo === "") return;
  const match =
    typeof logo === "string" &&
    /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(logo);
  if (!match) throw new Error("Choose a PNG, JPEG, or WebP logo image.");
  const image = Buffer.from(match[2], "base64");
  if (
    image.length > 2 * 1024 * 1024 ||
    image.toString("base64") !== match[2]
  ) {
    throw new Error("Logo images must be 2 MB or smaller.");
  }
  const validImage =
    (match[1] === "png" &&
      image.subarray(0, 8).equals(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      )) ||
    (match[1] === "jpeg" &&
      image[0] === 0xff &&
      image[1] === 0xd8 &&
      image[2] === 0xff) ||
    (match[1] === "webp" &&
      image.toString("ascii", 0, 4) === "RIFF" &&
      image.toString("ascii", 8, 12) === "WEBP");
  if (!validImage) throw new Error("The uploaded file is not a valid image.");
}

async function validateAutoPaySettings(settings) {
  if (!settings.autoPayEnabled) return;
  if (settings.type !== "credit_card")
    throw new Error("Automatic payments can only be enabled for credit cards.");
  const dueDay = Number(settings.dueDate);
  const billingDay = Number(settings.billingDate);
  if (
    !settings.paymentAccountId ||
    !Number.isInteger(dueDay) ||
    dueDay < 1 ||
    dueDay > 31 ||
    !Number.isInteger(billingDay) ||
    billingDay < 1 ||
    billingDay > 31
  ) {
    throw new Error(
      "Automatic payment requires a payment account, billing day, and due day.",
    );
  }
  if (
    !(await Account.exists({
      _id: settings.paymentAccountId,
      archived: false,
      type: { $ne: "credit_card" },
    }))
  ) {
    throw new Error("Choose an active non-credit-card payment account.");
  }
}

router.get("/", async (req, res) => {
  try {
    await processDueCreditCardPayments();
    const accounts = await Account.find({ archived: false })
      .sort({ createdAt: 1 })
      .lean();
    const txns = await Transaction.find({
      type: { $in: ["income", "expense", "transfer"] },
    }).lean();
    const result = accounts.map((a) => {
      const flow = txns.reduce((sum, t) => sum + accountDelta(t, a._id), 0);
      const isCard = a.type === "credit_card";
      const owed = isCard ? Math.max(0, -flow) : null;
      const used = owed;
      const available =
        isCard && a.creditLimit != null
          ? Math.max(0, a.creditLimit - used)
          : null;
      const statement = isCard ? creditCardStatement(a, txns) : {};
      return {
        ...a,
        balance: isCard ? -owed : (a.balanceAdjustment || 0) + flow,
        owed,
        used,
        available,
        ...statement,
      };
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/", async (req, res) => {
  try {
    validateLogo(req.body.logo);
    await validateAutoPaySettings({ ...req.body, type: req.body.type });
    const account = await Account.create(req.body);
    res.status(201).json(account);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    if (Object.hasOwn(req.body, "logo")) validateLogo(req.body.logo);
    const account = await Account.findById(req.params.id);
    if (!account) return res.status(404).json({ error: "Account not found." });

    await validateAutoPaySettings({
      type: req.body.type ?? account.type,
      autoPayEnabled: req.body.autoPayEnabled ?? account.autoPayEnabled,
      paymentAccountId: req.body.paymentAccountId ?? account.paymentAccountId,
      dueDate: req.body.dueDate ?? account.dueDate,
      billingDate: req.body.billingDate ?? account.billingDate,
    });

    const updates = {};
    for (const field of [
      "name",
      "type",
      "color",
      "logo",
      "creditLimit",
      "dueDate",
      "billingDate",
      "paymentAccountId",
      "autoPayEnabled",
    ]) {
      if (Object.hasOwn(req.body, field)) updates[field] = req.body[field];
    }
    if (Object.hasOwn(req.body, "autoPayEnabled")) {
      updates.autoPayEnabledAt = req.body.autoPayEnabled
        ? account.autoPayEnabled
          ? account.autoPayEnabledAt
          : new Date()
        : null;
    }
    const { currentBalance } = req.body;
    if (currentBalance !== undefined) {
      const desiredBalance = Number(currentBalance);
      if (!Number.isFinite(desiredBalance))
        return res.status(400).json({ error: "Enter a valid account balance." });
      if ((updates.type || account.type) === "credit_card")
        return res.status(400).json({
          error: "Credit card balances are calculated from card transactions.",
        });
      const transactions = await Transaction.find({
        type: { $in: ["income", "expense", "transfer"] },
      }).lean();
      const transactionBalance = transactions.reduce(
        (sum, transaction) =>
          sum + accountDelta(transaction, account._id),
        0,
      );
      account.balanceAdjustment = desiredBalance - transactionBalance;
    }

    account.set(updates);
    await account.save();
    res.json(account);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const count = await Transaction.countDocuments({
      $or: [
        { accountId: req.params.id },
        { fromAccountId: req.params.id },
        { toAccountId: req.params.id },
      ],
    });
    if (count > 0)
      return res
        .status(409)
        .json({ error: "Account has transactions. Archive it instead." });
    await Account.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
