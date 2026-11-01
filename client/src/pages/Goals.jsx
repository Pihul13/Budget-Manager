import React, { useEffect, useState } from "react";
import { ArrowLeftRight, Pencil, Plus, Target, Trash2 } from "lucide-react";
import { api } from "../lib/api.js";
import { money } from "../lib/format.js";
import { Empty, Modal } from "../App.jsx";
import { dateInput } from "../lib/format.js";
import FundSpendModal from "../components/FundSpendModal.jsx";
import ReallocationModal from "../components/ReallocationModal.jsx";

const blank = {
  name: "",
  targetAmount: "",
  targetDate: "",
  color: "#6D63D9",
  holdingAccountId: "",
};

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function Goals() {
  const [goals, setGoals] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [history, setHistory] = useState(null);
  const [spendingGoal, setSpendingGoal] = useState(null);
  const [reallocationGoal, setReallocationGoal] = useState(null);
  const [error, setError] = useState("");
  const [accounts, setAccounts] = useState([]);

  const load = () =>
    api
      .get("/api/goals")
      .then(setGoals)
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
    api
      .get("/api/accounts")
      .then(setAccounts)
      .catch(() => {});
  }, []);

  const open = (g) => {
    setEditing(g || {});
    setForm(
      g
        ? {
            ...g,
            targetDate: g.targetDate ? dateInput(g.targetDate) : "",
            holdingAccountId: g.holdingAccountId ? g.holdingAccountId._id : "",
          }
        : blank,
    );
  };

  const save = async () => {
    try {
      const p = {
        ...form,
        targetAmount: Number(form.targetAmount),
        targetDate: form.targetDate ? new Date(form.targetDate) : null,
        holdingAccountId: form.holdingAccountId || null,
      };
      if (editing?._id) await api.put(`/api/goals/${editing._id}`, p);
      else await api.post("/api/goals", p);
      setEditing(null);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const del = async (g) => {
    if (!confirm(`Delete ${g.name}?`)) return;
    try {
      await api.del(`/api/goals/${g._id}`);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const show = async (g) => {
    try {
      setHistory({
        goal: g,
        rows: await api.get(`/api/goals/${g._id}/history`),
      });
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <>
      <div className="page-actions">
        <div>
          <span className="muted">Money is still held in real accounts</span>
        </div>
        <button className="btn primary" onClick={() => open(null)}>
          <Plus size={17} /> Add goal
        </button>
      </div>
      {error && <div className="error">{error}</div>}

      <div className="goal-grid">
        {goals.map((g) => (
          <div className="goal-card" key={g._id}>
            <div className="row-between">
              <div
                className="goal-icon large"
                style={{ background: g.color + "20", color: g.color }}
              >
                <Target size={20} />
              </div>
              <div className="actions">
                <button className="icon-btn" onClick={() => open(g)}>
                  <Pencil size={15} />
                </button>
                <button className="icon-btn danger" onClick={() => del(g)}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            <h3>{g.name}</h3>
            <div className="goal-amount">
              <strong>{money(g.saved)}</strong>
              <span> / {money(g.targetAmount)}</span>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${g.progress}%`, background: g.color }}
              />
            </div>
            <div className="row-between tiny muted">
              <span>{g.progress.toFixed(0)}%</span>
              <span>{money(g.remaining)} remaining</span>
            </div>
            {g.holdingAccountId ? (
              <div className="muted tiny">
                Held in {g.holdingAccountId.name}
              </div>
            ) : null}
            {g.targetDate && (
              <div className="muted tiny">
                Target{" "}
                {new Date(g.targetDate).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </div>
            )}
            <button className="link-button" onClick={() => show(g)}>
              View goal history
            </button>
            <button
              className="btn small"
              onClick={() => setSpendingGoal(g)}
              disabled={!g.storageByAccount?.length}
            >
              Spend from goal
            </button>
            <button
              className="btn small"
              onClick={() => setReallocationGoal(g)}
              disabled={!g.storageByAccount?.length}
            >
              <ArrowLeftRight size={15} /> Move money
            </button>
          </div>
        ))}
      </div>

      {!goals.length && (
        <Empty
          title="No saving goals"
          text="Create a goal like your piano, trip or emergency fund."
          action={
            <button className="btn primary" onClick={() => open(null)}>
              Add goal
            </button>
          }
        />
      )}

      {editing && (
        <Modal
          title={editing._id ? "Edit goal" : "Add saving goal"}
          onClose={() => setEditing(null)}
        >
          <div className="form-grid">
            <Field label="Goal name">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Digital piano"
                autoFocus
              />
            </Field>

            <Field label="Target amount">
              <input
                type="number"
                min="0.01"
                value={form.targetAmount}
                onChange={(e) =>
                  setForm({ ...form, targetAmount: e.target.value })
                }
              />
            </Field>

            <Field label="Target date (optional)">
              <input
                type="date"
                value={form.targetDate || ""}
                onChange={(e) =>
                  setForm({ ...form, targetDate: e.target.value })
                }
              />
            </Field>

            <Field label="Color">
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
              />
            </Field>

            <Field label="Held in account (optional)">
              <select
                value={form.holdingAccountId || ""}
                onChange={(e) =>
                  setForm({ ...form, holdingAccountId: e.target.value })
                }
              >
                <option value="">-- none --</option>
                {accounts.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.name} • {a.type}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <p className="hint">
            To add money to a goal, create a transfer between real accounts and
            manually select this goal.
          </p>

          <div className="modal-actions">
            <button className="btn" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button className="btn primary" onClick={save}>
              Save
            </button>
          </div>
        </Modal>
      )}

      {spendingGoal && (
        <FundSpendModal
          item={spendingGoal}
          kind="goal"
          onClose={() => setSpendingGoal(null)}
          onSaved={() => {
            setSpendingGoal(null);
            setError("");
            load();
          }}
        />
      )}

      {reallocationGoal && (
        <ReallocationModal
          item={reallocationGoal}
          kind="goal"
          onClose={() => setReallocationGoal(null)}
          onSaved={() => {
            setReallocationGoal(null);
            setError("");
            load();
          }}
        />
      )}

      {history && (
        <Modal
          title={`History for ${history.goal.name}`}
          onClose={() => setHistory(null)}
        >
          <div className="history-list">
            {history.rows.map((r) => (
              <div key={r._id} className="history-row">
                <div>
                  <strong>
                    {r.type === "reallocation"
                      ? String(r.fromGoalId?._id) ===
                        String(history.goal._id)
                        ? `Moved to ${r.toGoalId?.name || r.toFundId?.name || "another fund"}`
                        : `Moved from ${r.fromGoalId?.name || r.fromFundId?.name || "another fund"}`
                      : r.type === "expense"
                        ? "Spent"
                        : "Contribution"}
                  </strong>
                  <div className="muted tiny">
                    {new Date(r.date).toLocaleDateString()} ·{" "}
                    {r.type === "reallocation"
                      ? r.accountId?.name || "—"
                      : r.type === "expense"
                      ? `${r.accountId?.name || "—"} · paid to ${r.paidTo || "—"}`
                      : `${r.fromAccountId?.name || "—"} → ${r.toAccountId?.name || "—"}`}
                    {r.description ? ` · ${r.description}` : ""}
                  </div>
                </div>
                <strong
                  className={
                    r.type === "expense" ||
                    (r.type === "reallocation" &&
                      String(r.fromGoalId?._id) === String(history.goal._id))
                      ? ""
                      : "positive"
                  }
                >
                  {r.type === "expense" ||
                  (r.type === "reallocation" &&
                    String(r.fromGoalId?._id) === String(history.goal._id))
                    ? "− "
                    : "+ "}
                  {money(r.amount)}
                </strong>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
