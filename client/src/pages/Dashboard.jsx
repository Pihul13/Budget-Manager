import React, { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  Plus,
  Target,
  Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { money } from "../lib/format.js";
import { budgetedCategorySpend } from "../lib/budget.js";
import { Empty, Panel } from "../App.jsx";

const chartColors = [
  "#6D63D9",
  "#F4C84B",
  "#5EC9AF",
  "#EB8383",
  "#70A0E0",
  "#A67CE2",
  "#B4B8C5",
  "#5E9B8A",
];

export default function Dashboard({ month }) {
  const [data, setData] = useState(null);
  const [goals, setGoals] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [budgetTransactions, setBudgetTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [budget, setBudget] = useState(null);
  const load = async () => {
    const [stats, gs, acs, tx, bd, budgetTx, cats] = await Promise.all([
      api.get(`/api/stats/month/${month}`),
      api.get("/api/goals"),
      api.get("/api/accounts"),
      api.get(
        `/api/transactions?from=${month}-01T00:00:00.000Z&to=${nextMonth(month)}-01T00:00:00.000Z&limit=7`,
      ),
      api.get(`/api/budgets/${month}`),
      api.get(
        `/api/transactions?from=${month}-01T00:00:00.000Z&to=${nextMonth(month)}-01T00:00:00.000Z&limit=1000`,
      ),
      api.get("/api/categories"),
    ]);
    setData(stats);
    setGoals(gs);
    setAccounts(acs);
    setTransactions(tx);
    setBudget(bd);
    setBudgetTransactions(budgetTx);
    setCategories(cats);
  };
  useEffect(() => {
    load().catch(console.error);
  }, [month]);
  if (!data) return <div className="loading">Loading your dashboard…</div>;
  const totalBudget = budget?.totalLimit || 0;
  const budgetSpend = budgetedCategorySpend(
    budgetTransactions,
    categories,
    budget?.categoryLimits,
  );
  const budgetSpent = Object.values(budgetSpend).reduce(
    (total, amount) => total + amount,
    0,
  );
  const budgetPct = totalBudget
    ? Math.min(100, (budgetSpent / totalBudget) * 100)
    : 0;
  return (
    <>
      <div className="hero-grid">
        <div className="hero-card">
          <div className="hero-label">Net worth</div>
          <div className="hero-value">{money(data.netWorth)}</div>
          <div className="hero-meta">
            <span>Assets {money(data.assets)}</span>
            <span>Liabilities {money(data.liabilities)}</span>
          </div>
        </div>
        <Metric
          icon={ArrowDownLeft}
          label="Income"
          value={data.income}
          positive
        />
        <Metric icon={ArrowUpRight} label="Expenses" value={data.expense} />
        <Metric
          icon={Target}
          label="Saved this month"
          value={data.savings}
          positive
        />
      </div>
      <div className="grid-2">
        <Panel
          title="Budget"
          action={
            <Link className="text-link" to="/budget">
              Manage
            </Link>
          }
        >
          <div className="budget-overview">
            <div>
              <span className="big-number">{money(budgetSpent)}</span>{" "}
              <span className="muted">/ {money(totalBudget)}</span>
            </div>
            <span>
              {totalBudget ? `${budgetPct.toFixed(0)}% used` : "No budget set"}
            </span>
          </div>
          <div className="progress-track large">
            <div className="progress-fill" style={{ width: `${budgetPct}%` }} />
          </div>
          {budget ? (
            <BudgetMini
              budget={budget}
              categories={categories}
              spend={budgetSpend}
            />
          ) : (
            <Empty
              title="No budget yet"
              text="Set your overall and category budgets."
              action={
                <Link className="btn primary" to="/budget">
                  Set budget
                </Link>
              }
            />
          )}
        </Panel>
        <Panel
          title="Saving goals"
          action={
            <Link className="text-link" to="/goals">
              View all
            </Link>
          }
        >
          {goals.length ? (
            <div className="goal-list">
              {goals.slice(0, 4).map((g) => (
                <div className="goal-row" key={g._id}>
                  <div
                    className="goal-icon"
                    style={{ background: g.color + "20", color: g.color }}
                  >
                    <Target size={18} />
                  </div>
                  <div className="grow">
                    <div className="row-between">
                      <strong>{g.name}</strong>
                      <span>{g.progress.toFixed(0)}%</span>
                    </div>
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{ width: `${g.progress}%`, background: g.color }}
                      />
                    </div>
                    <div className="muted tiny">
                      {money(g.saved)} / {money(g.targetAmount)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="No saving goals"
              text="Add goals for things you're saving toward."
              action={
                <Link className="btn primary" to="/goals">
                  Add goal
                </Link>
              }
            />
          )}
        </Panel>
      </div>
      <Panel
        title="Accounts"
        action={
          <Link className="text-link" to="/accounts">
            Manage
          </Link>
        }
      >
        <div className="account-strip">
          {accounts.map((a) => (
            <div className="account-card" key={a._id}>
              <div className="account-title">
                {a.logo ? (
                  <img className="account-logo-small" src={a.logo} alt="" />
                ) : (
                  <span className="dot" style={{ background: a.color }} />
                )}
                {a.name}
              </div>
              {a.type === "credit_card" ? (
                <>
                  <div className="muted capitalize">Credit card</div>
                  <div className="card-stat">
                    <span>Owed</span>
                    <strong>{money(a.owed)}</strong>
                  </div>
                  <div className="card-stat">
                    <span>Available</span>
                    <strong>{a.available == null ? "—" : money(a.available)}</strong>
                  </div>
                  <div className="card-stat">
                    <span>Limit</span>
                    <strong>{money(a.creditLimit || 0)}</strong>
                  </div>
                  <div className="card-stat">
                    <span>
                      Due {a.nextDueDate ? formatDate(a.nextDueDate) : ""}
                    </span>
                    <strong>
                      {a.statementAmount == null
                        ? "—"
                        : money(a.statementAmount)}
                    </strong>
                  </div>
                  <div className="muted tiny">
                    {a.statementDate
                      ? `Statement date ${formatDate(a.statementDate)}`
                      : "Set billing and due days to calculate the statement amount"}{" "}
                    · paid from{" "}
                    {accounts.find(
                      (account) =>
                        String(account._id) === String(a.paymentAccountId),
                    )?.name || "—"}
                  </div>
                </>
              ) : (
                <>
                  <div className="money-amount">{money(a.balance)}</div>
                  <span className="muted">{a.type.replace("_", " ")}</span>
                </>
              )}
            </div>
          ))}
        </div>
        {!accounts.length && (
          <Empty
            title="No accounts"
            text="Add your salary, savings and credit accounts."
            action={
              <Link className="btn primary" to="/accounts">
                Add account
              </Link>
            }
          />
        )}
      </Panel>
      <Panel
        title="Recent transactions"
        action={
          <Link className="text-link" to="/transactions">
            View all
          </Link>
        }
      >
        {transactions.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Account</th>
                  <th className="right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t._id}>
                    <td>
                      {new Date(t.date).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </td>
                    <td>
                      {t.description ||
                        (t.type === "reallocation"
                          ? `${t.fromFundId?.name || t.fromGoalId?.name || "—"} → ${t.toFundId?.name || t.toGoalId?.name || "—"}`
                          : "—")}
                    </td>
                    <td>
                      {t.type === "reallocation"
                        ? "Reallocation"
                        : t.categoryId?.name || "—"}
                      {t.subcategoryId ? ` / ${t.subcategoryId.name}` : ""}
                    </td>
                    <td>
                      {t.type === "transfer"
                        ? `${t.fromAccountId?.name || ""} → ${t.toAccountId?.name || ""}`
                        : t.accountId?.name}
                    </td>
                    <td
                      className={`right amount ${t.type === "income" ? "income" : t.type === "expense" ? "expense" : ""}`}
                    >
                      {t.type === "income"
                        ? "+ "
                        : t.type === "expense"
                          ? "- "
                          : ""}
                      {money(t.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No transactions"
            text="Add your first income or expense."
            action={
              <Link className="btn primary" to="/transactions">
                Add transaction
              </Link>
            }
          />
        )}
      </Panel>
    </>
  );
}

function BudgetMini({ budget, categories, spend }) {
  const limits = new Set(
    (budget.categoryLimits || [])
      .filter((limit) => Number(limit.amount) > 0)
      .map((limit) => String(limit.categoryId?._id || limit.categoryId)),
  );
  const categoriesById = new Map(
    categories.map((category) => [String(category._id), category]),
  );
  const categorySpend = categories
    .filter((category) => !category.parentId && limits.has(String(category._id)))
    .map((category) => ({
      name: category.name,
      amount: Object.entries(spend)
        .filter(([id]) => {
          const spentCategory = categoriesById.get(id);
          const parentId =
            spentCategory?.parentId?._id ||
            spentCategory?.parentId ||
            spentCategory?._id;
          return String(parentId) === String(category._id);
        })
        .reduce((total, [, amount]) => total + amount, 0),
    }))
    .filter((item) => item.amount > 0)
    .slice(0, 5);
  return (
    <div className="mini-budget">
      {categorySpend.map(({ name, amount }, i) => (
        <div className="mini-row" key={name}>
          <div>
            <span
              className="swatch"
              style={{ background: chartColors[i % chartColors.length] }}
            />
            {name}
          </div>
          <strong>{money(amount)}</strong>
        </div>
      ))}
    </div>
  );
}
function Metric({ icon: Icon, label, value, positive }) {
  return (
    <div className="metric-card">
      <div className="metric-icon">
        <Icon size={17} />
      </div>
      <span>{label}</span>
      <strong className={positive ? "positive" : ""}>{money(value)}</strong>
    </div>
  );
}
function nextMonth(month) {
  const d = new Date(`${month}-01T00:00:00`);
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function formatDate(value) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}
