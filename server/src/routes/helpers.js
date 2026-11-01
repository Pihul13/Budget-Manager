export function monthBounds(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  const end = new Date(Date.UTC(year, monthNumber, 1));
  return { start, end };
}

export function toMonth(date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function addFrequency(date, frequency, interval = 1) {
  const next = new Date(date);
  if (frequency === "daily") next.setUTCDate(next.getUTCDate() + interval);
  if (frequency === "weekly") next.setUTCDate(next.getUTCDate() + 7 * interval);
  if (frequency === "monthly") next.setUTCMonth(next.getUTCMonth() + interval);
  if (frequency === "yearly")
    next.setUTCFullYear(next.getUTCFullYear() + interval);
  return next;
}

export function accountDelta(transaction, accountId) {
  const id = String(accountId);
  if (transaction.type === "income" && String(transaction.accountId) === id)
    return transaction.amount;
  if (transaction.type === "expense" && String(transaction.accountId) === id)
    return -transaction.amount;
  if (transaction.type === "transfer") {
    if (String(transaction.fromAccountId) === id) return -transaction.amount;
    if (String(transaction.toAccountId) === id) return transaction.amount;
  }
  return 0;
}

export function earmarkDelta(transaction, kind, bucketId, accountId) {
  const idOf = (value) => value?._id ?? value;
  const bucket = String(bucketId);
  const account = String(accountId);
  if (transaction.type === "reallocation") {
    const fromId =
      kind === "fund" ? transaction.fromFundId : transaction.fromGoalId;
    const toId = kind === "fund" ? transaction.toFundId : transaction.toGoalId;
    if (String(idOf(fromId)) === bucket && String(idOf(transaction.accountId)) === account)
      return -transaction.amount;
    if (String(idOf(toId)) === bucket && String(idOf(transaction.accountId)) === account)
      return transaction.amount;
    return 0;
  }
  const id = kind === "fund" ? transaction.fundId : transaction.goalId;
  if (String(idOf(id)) !== bucket) return 0;
  if (transaction.type === "expense")
    return String(idOf(transaction.accountId)) === account ? -transaction.amount : 0;
  if (transaction.type !== "transfer") return 0;
  if (kind === "fund" && transaction.fundAction === "withdrawal")
    return String(idOf(transaction.fromAccountId)) === account
      ? -transaction.amount
      : 0;
  return String(idOf(transaction.toAccountId)) === account ? transaction.amount : 0;
}

function utcDateForDay(year, month, day) {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay)));
}

export function creditCardStatement(account, transactions, asOf = new Date()) {
  const dueDay = Number(account.dueDate);
  const billingDay = Number(account.billingDate);
  if (
    !Number.isInteger(dueDay) ||
    dueDay < 1 ||
    dueDay > 31 ||
    !Number.isInteger(billingDay) ||
    billingDay < 1 ||
    billingDay > 31
  ) {
    return { statementAmount: null, statementDate: null, nextDueDate: null };
  }

  const today = new Date(
    Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()),
  );
  let nextDueDate = utcDateForDay(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    dueDay,
  );
  if (nextDueDate < today) {
    nextDueDate = utcDateForDay(
      today.getUTCFullYear(),
      today.getUTCMonth() + 1,
      dueDay,
    );
  }

  const statementMonth =
    nextDueDate.getUTCMonth() - (dueDay <= billingDay ? 1 : 0);
  const statementDate = utcDateForDay(
    nextDueDate.getUTCFullYear(),
    statementMonth,
    billingDay,
  );
  const statementEnd = statementDate.getTime() + 24 * 60 * 60 * 1000;
  const now = asOf.getTime();
  const accountId = String(account._id);
  let amount = 0;

  for (const transaction of transactions) {
    const date = new Date(transaction.date).getTime();
    if (date > now) continue;

    if (date < statementEnd) {
      amount -= accountDelta(transaction, accountId);
    } else if (date >= statementEnd) {
      if (
        (transaction.type === "income" &&
          String(transaction.accountId) === accountId) ||
        (transaction.type === "transfer" &&
          String(transaction.toAccountId) === accountId)
      ) {
        amount -= transaction.amount;
      }
    }
  }

  return {
    statementAmount: Math.max(0, amount),
    statementDate,
    nextDueDate,
  };
}
