import Account from "../models/Account.js";
import Transaction from "../models/Transaction.js";
import { creditCardStatement } from "../routes/helpers.js";
import { withTenantScope } from "../lib/tenantScope.js";

function dueDateForMonth(year, month, day) {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay)));
}

export async function processDueCreditCardPayments(asOf = new Date()) {
  const today = new Date(
    Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()),
  );
  const [cards, transactions] = await Promise.all([
    Account.find({
      type: "credit_card",
      archived: false,
      autoPayEnabled: true,
      paymentAccountId: { $ne: null },
    }).lean(),
    Transaction.find({ type: { $in: ["income", "expense", "transfer"] } }).lean(),
  ]);
  const paymentAccounts = new Set(
    (
      await Account.find({
        _id: { $in: cards.map((card) => card.paymentAccountId) },
        archived: false,
        type: { $ne: "credit_card" },
      })
        .select("_id")
        .lean()
    ).map((account) => String(account._id)),
  );

  for (const card of cards) {
    const dueDay = Number(card.dueDate);
    if (
      !paymentAccounts.has(String(card.paymentAccountId)) ||
      !Number.isInteger(dueDay) ||
      dueDay < 1 ||
      dueDay > 31
    ) {
      continue;
    }

    const enabledAt = card.autoPayEnabledAt || card.updatedAt;
    if (!enabledAt) continue;
    const enabledDate = new Date(
      Date.UTC(
        enabledAt.getUTCFullYear(),
        enabledAt.getUTCMonth(),
        enabledAt.getUTCDate(),
      ),
    );

    for (
      let year = enabledAt.getUTCFullYear(), month = enabledAt.getUTCMonth();
      year < today.getUTCFullYear() ||
      (year === today.getUTCFullYear() && month <= today.getUTCMonth());
      month++
    ) {
      if (month > 11) {
        year++;
        month = 0;
      }

      const dueDate = dueDateForMonth(year, month, dueDay);
      if (dueDate < enabledDate || dueDate > today) continue;

      const dueKey = dueDate.toISOString().slice(0, 10);
      const autoPaymentKey = `${card._id}:${dueKey}`;
      if (
        transactions.some(
          (transaction) => transaction.autoPaymentKey === autoPaymentKey,
        )
      ) {
        continue;
      }

      const throughDueDate = new Date(dueDate);
      throughDueDate.setUTCHours(23, 59, 59, 999);
      const statement = creditCardStatement(
        card,
        transactions,
        throughDueDate,
      );
      const statementAmount = statement.statementAmount || 0;
      if (!statementAmount) continue;

      const nextDay = new Date(dueDate);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      const laterPayments = transactions
        .filter(
          (transaction) =>
            transaction.type === "transfer" &&
            String(transaction.toAccountId) === String(card._id) &&
            new Date(transaction.date) >= nextDay &&
            new Date(transaction.date) <= asOf,
        )
        .reduce((total, transaction) => total + transaction.amount, 0);
      const amount = Math.max(0, statementAmount - laterPayments);
      if (!amount) continue;

      const payment = {
        type: "transfer",
        amount,
        fromAccountId: card.paymentAccountId,
        toAccountId: card._id,
        date: dueDate,
        description: "Automatic credit card payment",
        note: `Statement payment due ${dueKey}`,
        autoPaymentKey,
      };

      try {
        await Transaction.create(payment);
      } catch (error) {
        if (error.code === 11000) continue;
        throw error;
      }
      transactions.push(payment);
    }
  }
}

export async function processDuePaymentsForAllUsers() {
  const userIds = await Account.collection.distinct("userId", {
    userId: { $type: "string" },
  });
  for (const userId of userIds) {
    await withTenantScope(userId, () => processDueCreditCardPayments());
  }
}
