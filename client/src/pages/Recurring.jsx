import React, { useEffect, useState } from "react";
import { Pencil, Play, Plus, SkipForward, Trash2 } from "lucide-react";
import { api } from "../lib/api.js";
import { money, dateInput } from "../lib/format.js";
import { Modal, Empty } from "../App.jsx";
const blank = {
  name: "",
  type: "expense",
  amount: "",
  accountId: "",
  fromAccountId: "",
  toAccountId: "",
  categoryId: "",
  subcategoryId: "",
  frequency: "monthly",
  interval: 1,
  nextRunDate: dateInput(),
  enabled: true,
  note: "",
};
export default function Recurring() {
  const [rules, setRules] = useState([]),
    [accounts, setAccounts] = useState([]),
    [cats, setCats] = useState([]),
    [editing, setEditing] = useState(null),
    [form, setForm] = useState(blank),
    [error, setError] = useState("");
  const load = async () => {
    const [a, c, r] = await Promise.all([
      api.get("/api/accounts"),
      api.get("/api/categories"),
      api.get("/api/recurring"),
    ]);
    setAccounts(a);
    setCats(c);
    setRules(r);
  };
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  const open = (r) => {
    setEditing(r || {});
    setForm(
      r
        ? {
            ...r,
            nextRunDate: dateInput(r.nextRunDate),
            accountId: r.accountId?._id || "",
            fromAccountId: r.fromAccountId?._id || "",
            toAccountId: r.toAccountId?._id || "",
            categoryId: r.categoryId?._id || "",
            subcategoryId: r.subcategoryId?._id || "",
          }
        : blank,
    );
  };
  const save = async () => {
    try {
      const p = {
        ...form,
        amount: Number(form.amount),
        nextRunDate: new Date(form.nextRunDate),
      };
      if (editing?._id) await api.put(`/api/recurring/${editing._id}`, p);
      else await api.post("/api/recurring", p);
      setEditing(null);
      load();
    } catch (e) {
      setError(e.message);
    }
  };
  const run = async (r) => {
    try {
      await api.post(`/api/recurring/${r._id}/execute`, {});
      load();
    } catch (e) {
      setError(e.message);
    }
  };
  const skip = async (r) => {
    await api.post(`/api/recurring/${r._id}/skip`, {});
    load();
  };
  const toggle = async (r) => {
    await api.put(`/api/recurring/${r._id}`, { enabled: !r.enabled });
    load();
  };
  const del = async (r) => {
    if (confirm(`Delete ${r.name}?`)) {
      await api.del(`/api/recurring/${r._id}`);
      load();
    }
  };
  const parents = cats.filter((c) => c.type === form.type && !c.parentId);
  const subs = cats.filter(
    (c) => String(c.parentId) === String(form.categoryId),
  );
  return (
    <>
      <div className="page-actions">
        <div>
          <span className="muted">Optional rules</span>
        </div>
        <button className="btn primary" onClick={() => open(null)}>
          <Plus size={17} /> Add recurring
        </button>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="rule-list">
        {rules.map((r) => (
          <div
            className={`rule-card ${r.enabled ? "" : "disabled"}`}
            key={r._id}
          >
            <div className="rule-main">
              <div className="rule-icon">↻</div>
              <div>
                <h3>{r.name}</h3>
                <span className="muted">
                  {r.type} · {money(r.amount)} · {r.frequency}
                  {r.interval > 1 ? ` × ${r.interval}` : ""}
                </span>
                <span className="muted tiny">
                  Next:{" "}
                  {new Date(r.nextRunDate).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
            <div className="actions">
              <button className="btn small" onClick={() => toggle(r)}>
                {r.enabled ? "Disable" : "Enable"}
              </button>
              <button
                className="icon-btn"
                title="Create next transaction"
                onClick={() => run(r)}
              >
                <Play size={15} />
              </button>
              <button
                className="icon-btn"
                title="Skip next occurrence"
                onClick={() => skip(r)}
              >
                <SkipForward size={15} />
              </button>
              <button className="icon-btn" onClick={() => open(r)}>
                <Pencil size={15} />
              </button>
              <button className="icon-btn danger" onClick={() => del(r)}>
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}{" "}
      </div>
      {!rules.length && (
        <Empty
          title="No recurring transactions"
          text="Add recurring rent, salary, gym or subscriptions when you want them."
          action={
            <button className="btn primary" onClick={() => open(null)}>
              <Plus size={16} /> Add recurring
            </button>
          }
        />
      )}{" "}
      {editing && (
        <Modal
          title={editing._id ? "Edit recurring" : "Add recurring"}
          onClose={() => setEditing(null)}
          wide
        >
          <div className="form-grid">
            <Field label="Name">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="Type">
              <select
                value={form.type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    type: e.target.value,
                    categoryId: "",
                    subcategoryId: "",
                  })
                }
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="transfer">Transfer</option>
              </select>
            </Field>
            <Field label="Amount">
              <input
                type="number"
                min="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </Field>
            <Field label="Frequency">
              <select
                value={form.frequency}
                onChange={(e) =>
                  setForm({ ...form, frequency: e.target.value })
                }
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </Field>
            <Field label="Every">
              <input
                type="number"
                min="1"
                value={form.interval}
                onChange={(e) =>
                  setForm({ ...form, interval: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Next run">
              <input
                type="date"
                value={form.nextRunDate}
                onChange={(e) =>
                  setForm({ ...form, nextRunDate: e.target.value })
                }
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
                    <option value="">None</option>
                    {subs.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
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
              </>
            )}
            <Field label="Note">
              <input
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
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
              disabled={!form.name || !form.amount}
            >
              Save
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
