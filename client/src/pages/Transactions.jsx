import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  Pencil,
  Plus,
  Trash2,
  WalletCards,
} from "lucide-react";
import { api } from "../lib/api.js";
import { dateInput, money } from "../lib/format.js";
import { Empty, Modal } from "../App.jsx";

const blank = (month) => ({
  type: "expense",
  amount: "",
  accountId: "",
  fromAccountId: "",
  toAccountId: "",
  categoryId: "",
  subcategoryId: "",
  goalId: "",
  fundId: "",
  fundAction: "",
  paidTo: "",
  description: "",
  note: "",
  date: transactionDateForMonth(month),
});
export default function Transactions({ month }) {
  const [rows, setRows] = useState([]),
    [accounts, setAccounts] = useState([]),
    [cats, setCats] = useState([]),
    [goals, setGoals] = useState([]),
    [funds, setFunds] = useState([]),
    [editing, setEditing] = useState(null),
    [form, setForm] = useState(blank(month)),
    [error, setError] = useState(""),
    [accountFilter, setAccountFilter] = useState("");
  const load = async () => {
    try {
      const next = nextMonth(month);
      const [tx, acs, cs, gs, fs] = await Promise.all([
        api.get(
          `/api/transactions?from=${month}-01T00:00:00.000Z&to=${next}-01T00:00:00.000Z&limit=500`,
        ),
        api.get("/api/accounts"),
        api.get("/api/categories"),
        api.get("/api/goals"),
        api.get("/api/funds"),
      ]);
      setRows(tx);
      setAccounts(acs);
      setCats(cs);
      setGoals(gs);
      setFunds(fs);
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => {
    load();
  }, [month]);
  const expenseCats = cats.filter(
    (c) => c.type === "expense" && c.parentId == null,
  );
  const incomeCats = cats.filter(
    (c) => c.type === "income" && c.parentId == null,
  );
  const parents = cats.filter(
    (c) => c.type === form.type && c.parentId == null,
  );
  const subs = cats.filter(
    (c) => String(c.parentId) === String(form.categoryId),
  );
  const filteredRows = accountFilter
    ? rows.filter((row) =>
        row.type === "transfer"
          ? [row.fromAccountId?._id, row.toAccountId?._id].some(
              (id) => String(id) === accountFilter,
            )
          : String(row.accountId?._id) === accountFilter,
      )
    : rows;
  const open = (row) => {
    setEditing(row || {});
    setForm(
      row
        ? {
            ...blank(month),
            ...row,
            date: dateInput(row.date),
            accountId: row.accountId?._id || "",
            fromAccountId: row.fromAccountId?._id || "",
            toAccountId: row.toAccountId?._id || "",
            categoryId: row.categoryId?._id || "",
            subcategoryId: row.subcategoryId?._id || "",
            goalId: row.goalId?._id || "",
            fundId: row.fundId?._id || "",
            fundAction: row.fundAction || "",
            paidTo: row.paidTo || "",
          }
        : blank(month),
    );
  };
  const save = async () => {
    try {
      const p = {
        ...form,
        amount: Number(form.amount),
        categoryId: form.type === "transfer" ? null : form.categoryId || null,
        subcategoryId:
          form.type === "transfer" ? null : form.subcategoryId || null,
        goalId:
          form.type === "transfer" || form.type === "expense"
            ? form.goalId || null
            : null,
        fundId:
          form.type === "transfer" || form.type === "expense"
            ? form.fundId || null
            : null,
        fundAction:
          form.fundId &&
          (form.type === "expense" || form.type === "transfer")
          ? form.type === "expense"
            ? "withdrawal"
            : form.fundAction
          : null,
      };
      if (form.type === "transfer") {
        p.accountId = null;
      } else {
        p.fromAccountId = null;
        p.toAccountId = null;
      }
      if (editing?._id) await api.put(`/api/transactions/${editing._id}`, p);
      else await api.post("/api/transactions", p);
      setEditing(null);
      load();
    } catch (e) {
      setError(e.message);
    }
  };
  const remove = async (r) => {
    if (!confirm("Delete this transaction?")) return;
    try {
      await api.del(`/api/transactions/${r._id}`);
      load();
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <>
      <div className="page-actions">
        <button className="btn primary" onClick={() => open(null)}>
          <Plus size={17} /> Add transaction
        </button>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="row-between" style={{ marginBottom: 14 }}>
        <label className="field" style={{ minWidth: 220, maxWidth: 320 }}>
          <span>Show transactions for</span>
          <select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
          >
            <option value="">All accounts</option>
            {accounts.map((account) => (
              <option key={account._id} value={account._id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {filteredRows.length ? (
        <div className="panel table-panel">
          <div className="table-wrap">
            <table className="transactions-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Account</th>
                  <th className="right">Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => (
                  <tr key={r._id}>
                    <td>
                      {new Date(r.date).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td>
                      <span className={`pill ${r.type}`}>
                        {r.type === "reallocation" ? "Reallocation" : r.type}
                      </span>
                    </td>
                    <td>
                      {r.description || "—"}
                      {r.paidTo && (
                        <div className="muted tiny">Paid to {r.paidTo}</div>
                      )}
                      {r.recurringRuleId && (
                        <div className="muted tiny">Recurring transaction</div>
                      )}
                      {r.autoPaymentKey && (
                        <div className="muted tiny">
                          Automatic statement payment
                        </div>
                      )}
                    </td>
                    <td>
                      {r.type === "reallocation"
                        ? `${r.fromFundId?.name || r.fromGoalId?.name || "—"} → ${r.toFundId?.name || r.toGoalId?.name || "—"}`
                        : r.type === "transfer"
                        ? r.fundId
                          ? `Fund: ${r.fundId.name} (${r.fundAction})`
                          : r.goalId
                            ? `Goal: ${r.goalId.name}`
                            : "—"
                        : [
                            r.categoryId?.name,
                            r.fundId && `Fund: ${r.fundId.name}`,
                            r.goalId && `Goal: ${r.goalId.name}`,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                      {r.subcategoryId ? ` / ${r.subcategoryId.name}` : ""}
                    </td>
                    <td>
                      {r.type === "transfer"
                        ? `${r.fromAccountId?.name || "—"} → ${r.toAccountId?.name || "—"}`
                        : r.accountId?.name}
                    </td>
                    <td className={`right amount ${r.type}`}>
                      {r.type === "income"
                        ? "+ "
                        : r.type === "expense"
                          ? "- "
                          : ""}
                      {money(r.amount)}
                    </td>
                    <td>
                      <div className="actions">
                        {!r.autoPaymentKey && (
                          <>
                            {r.type !== "reallocation" && (
                              <button
                                className="icon-btn"
                                onClick={() => open(r)}
                              >
                                <Pencil size={15} />
                              </button>
                            )}
                            <button
                              className="icon-btn danger"
                              onClick={() => remove(r)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <Empty
          title={
            accountFilter
              ? "No transactions for this account"
              : "No transactions this month"
          }
          text={
            accountFilter
              ? "Try another account or switch back to all accounts."
              : "Start recording income, expenses or account transfers."
          }
          action={
            accountFilter ? (
              <button
                className="btn"
                onClick={() => setAccountFilter("")}
              >
                Show all accounts
              </button>
            ) : (
              <button className="btn primary" onClick={() => open(null)}>
                <Plus size={16} /> Add transaction
              </button>
            )
          }
        />
      )}
      {editing && (
        <Modal
          title={editing._id ? "Edit transaction" : "Add transaction"}
          onClose={() => setEditing(null)}
          wide
        >
          <div className="segmented">
            {["expense", "income", "transfer"].map((t) => (
              <button
                key={t}
                className={form.type === t ? "selected" : ""}
                onClick={() =>
                  setForm({
                    ...form,
                    type: t,
                    categoryId: "",
                    subcategoryId: "",
                  })
                }
              >
                {t === "transfer" ? (
                  <ArrowLeftRight size={16} />
                ) : (
                  <WalletCards size={16} />
                )}{" "}
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <div className="form-grid">
            <Field label="Amount">
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                autoFocus
              />
            </Field>
            <Field label="Date">
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </Field>
            {form.type !== "transfer" ? (
              <>
                <Field label="Account">
                  <select
                    value={form.accountId}
                    onChange={(e) =>
                      setForm({ ...form, accountId: e.target.value })
                    }
                  >
                    <option value="">Select account</option>
                    {accounts.map((a) => (
                      <option key={a._id} value={a._id}>
                        {a.name}
                        {a.type === "credit_card" ? " · credit card" : ""}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Category">
                  <select
                    value={form.categoryId}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        categoryId: e.target.value,
                        subcategoryId: "",
                      })
                    }
                  >
                    <option value="">Select category</option>
                    {parents.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Subcategory">
                  <select
                    value={form.subcategoryId}
                    onChange={(e) =>
                      setForm({ ...form, subcategoryId: e.target.value })
                    }
                  >
                    <option value="">No subcategory</option>
                    {subs.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                {form.type === "expense" && (
                  <>
                    <Field label="Paid to">
                      <input
                        value={form.paidTo}
                        onChange={(e) =>
                          setForm({ ...form, paidTo: e.target.value })
                        }
                        placeholder="Person or business (optional)"
                      />
                    </Field>
                    <Field label="Saving goal (optional)">
                      <select
                        value={form.goalId || ""}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            goalId: e.target.value,
                            fundId: e.target.value ? "" : form.fundId,
                            fundAction: e.target.value ? "" : form.fundAction,
                          })
                        }
                      >
                        <option value="">No goal</option>
                        {goals.map((goal) => (
                          <option key={goal._id} value={goal._id}>
                            {goal.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Fund (optional)">
                      <select
                        value={form.fundId || ""}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            fundId: e.target.value,
                            fundAction: e.target.value ? "withdrawal" : "",
                            goalId: e.target.value ? "" : form.goalId,
                          })
                        }
                      >
                        <option value="">No fund</option>
                        {funds.map((fund) => (
                          <option key={fund._id} value={fund._id}>
                            {fund.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </>
                )}
              </>
            ) : (
              <>
                <Field label="From">
                  <select
                    value={form.fromAccountId}
                    onChange={(e) =>
                      setForm({ ...form, fromAccountId: e.target.value })
                    }
                  >
                    <option value="">Select source</option>
                    {accounts.map((a) => (
                      <option key={a._id} value={a._id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="To">
                  <select
                    value={form.toAccountId}
                    onChange={(e) =>
                      setForm({ ...form, toAccountId: e.target.value })
                    }
                  >
                    <option value="">Select destination</option>
                    {accounts.map((a) => (
                      <option key={a._id} value={a._id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Saving goal (optional)">
                  <select
                    value={form.goalId || ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        goalId: e.target.value,
                        fundId: e.target.value ? "" : form.fundId,
                        fundAction: e.target.value ? "" : form.fundAction,
                      })
                    }
                  >
                    <option value="">No goal</option>
                    {goals.map((g) => (
                      <option key={g._id} value={g._id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Fund (optional)">
                  <select
                    value={form.fundId || ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        fundId: e.target.value,
                        fundAction: e.target.value
                          ? form.fundAction || "contribution"
                          : "",
                        goalId: e.target.value ? "" : form.goalId,
                      })
                    }
                  >
                    <option value="">No fund</option>
                    {funds.map((fund) => (
                      <option key={fund._id} value={fund._id}>
                        {fund.name}
                      </option>
                    ))}
                  </select>
                </Field>
                {form.fundId && (
                  <Field label="Fund action">
                    <select
                      value={form.fundAction}
                      onChange={(e) =>
                        setForm({ ...form, fundAction: e.target.value })
                      }
                    >
                      <option value="contribution">Add to fund</option>
                      <option value="withdrawal">Withdraw from fund</option>
                    </select>
                  </Field>
                )}
              </>
            )}
            <Field label="Description">
              <input
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Rent, salary, groceries…"
              />
            </Field>
            <Field label="Note">
              <input
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="Optional"
              />
            </Field>
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button
              className="btn primary"
              onClick={save}
              disabled={!form.amount}
            >
              Save transaction
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function nextMonth(month) {
  const d = new Date(`${month}-01T00:00:00`);
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function transactionDateForMonth(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const today = new Date();
  const day = Math.min(
    today.getDate(),
    new Date(year, monthNumber, 0).getDate(),
  );
  return dateInput(new Date(year, monthNumber - 1, day));
}
