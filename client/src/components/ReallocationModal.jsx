import React, { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { dateInput, money } from "../lib/format.js";
import { Modal } from "../App.jsx";

export default function ReallocationModal({ item, kind, onClose, onSaved }) {
  const [funds, setFunds] = useState([]);
  const [goals, setGoals] = useState([]);
  const [form, setForm] = useState({
    amount: "",
    accountId: item.storageByAccount?.[0]?.accountId || "",
    destination: "",
    date: dateInput(),
    note: "",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.get("/api/funds"), api.get("/api/goals")])
      .then(([nextFunds, nextGoals]) => {
        setFunds(nextFunds);
        setGoals(nextGoals);
      })
      .catch((e) => setError(e.message));
  }, []);

  const sourceId = String(item._id);
  const destinations = [
    ...funds
      .filter((fund) => kind !== "fund" || String(fund._id) !== sourceId)
      .map((fund) => ({ id: `fund:${fund._id}`, label: fund.name })),
    ...goals
      .filter((goal) => kind !== "goal" || String(goal._id) !== sourceId)
      .map((goal) => ({ id: `goal:${goal._id}`, label: goal.name })),
  ];

  const save = async () => {
    try {
      const [toKind, toId] = form.destination.split(":");
      await api.post("/api/transactions", {
        type: "reallocation",
        amount: Number(form.amount),
        accountId: form.accountId,
        fromFundId: kind === "fund" ? item._id : null,
        fromGoalId: kind === "goal" ? item._id : null,
        toFundId: toKind === "fund" ? toId : null,
        toGoalId: toKind === "goal" ? toId : null,
        date: form.date,
        description: `Moved from ${item.name} to ${
          destinations.find((destination) => destination.id === form.destination)
            ?.label || "another fund or goal"
        }`,
        note: form.note,
      });
      onSaved();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <Modal title={`Move money from ${item.name}`} onClose={onClose}>
      {error && <div className="error">{error}</div>}
      <div className="form-grid">
        <Field label="Amount">
          <input
            type="number"
            min="0.01"
            step="0.01"
            max={
              item.storageByAccount?.find(
                (storage) => storage.accountId === form.accountId,
              )?.amount
            }
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            autoFocus
          />
        </Field>
        <Field label="Held in account">
          <select
            value={form.accountId}
            onChange={(e) => setForm({ ...form, accountId: e.target.value })}
          >
            <option value="">Select account</option>
            {item.storageByAccount?.map((storage) => (
              <option key={storage.accountId} value={storage.accountId}>
                {storage.accountName} · {money(storage.amount)} available
              </option>
            ))}
          </select>
        </Field>
        <Field label="Move to">
          <select
            value={form.destination}
            onChange={(e) =>
              setForm({ ...form, destination: e.target.value })
            }
          >
            <option value="">Select a fund or goal</option>
            {funds.length > 0 && (
              <optgroup label="Funds">
                {destinations
                  .filter((destination) => destination.id.startsWith("fund:"))
                  .map((destination) => (
                    <option key={destination.id} value={destination.id}>
                      {destination.label}
                    </option>
                  ))}
              </optgroup>
            )}
            {goals.length > 0 && (
              <optgroup label="Saving goals">
                {destinations
                  .filter((destination) => destination.id.startsWith("goal:"))
                  .map((destination) => (
                    <option key={destination.id} value={destination.id}>
                      {destination.label}
                    </option>
                  ))}
              </optgroup>
            )}
          </select>
        </Field>
        <Field label="Date">
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </Field>
        <Field label="Note (optional)">
          <input
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        </Field>
      </div>
      <p className="hint">
        This moves the earmark to another fund or goal in the same account. It
        does not change your real account balance.
      </p>
      {!destinations.length && (
        <p className="muted tiny">
          Create another fund or saving goal before moving this balance.
        </p>
      )}
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn primary"
          onClick={save}
          disabled={
            !Number(form.amount) ||
            !form.accountId ||
            !form.destination ||
            !destinations.length ||
            Number(form.amount) >
              (item.storageByAccount?.find(
                (storage) => storage.accountId === form.accountId,
              )?.amount || 0)
          }
        >
          Move money
        </button>
      </div>
    </Modal>
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
