import React, { useState } from "react";
import { api } from "../lib/api.js";
import { dateInput, money } from "../lib/format.js";
import { Modal } from "../App.jsx";

export default function FundSpendModal({
  item,
  kind,
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState({
    amount: "",
    accountId: item.storageByAccount?.[0]?.accountId || "",
    paidTo: "",
    description: "",
    note: "",
    date: dateInput(),
  });
  const [error, setError] = useState("");

  const save = async () => {
    try {
      await api.post("/api/transactions", {
        type: "expense",
        amount: Number(form.amount),
        accountId: form.accountId,
        ...(kind === "fund"
          ? { fundId: item._id, fundAction: "withdrawal" }
          : { goalId: item._id }),
        paidTo: form.paidTo.trim(),
        description: form.description.trim() || `Spent from ${item.name}`,
        note: form.note,
        date: form.date,
      });
      onSaved();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <Modal
      title={`Spend from ${item.name}`}
      onClose={onClose}
    >
      {error && <div className="error">{error}</div>}
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
        <Field label="Paid from account">
          <select
            value={form.accountId}
            onChange={(e) => setForm({ ...form, accountId: e.target.value })}
          >
            <option value="">Select account</option>
            {item.storageByAccount?.map((storage) => (
              <option key={storage.accountId} value={storage.accountId}>
                {storage.accountName} · {money(storage.amount)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Paid to">
          <input
            value={form.paidTo}
            onChange={(e) => setForm({ ...form, paidTo: e.target.value })}
            placeholder="Person or business"
          />
        </Field>
        <Field label="What was it for? (optional)">
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
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
        This records an expense from the selected account and reduces the
        {kind === "fund" ? " fund" : " goal"} balance.
      </p>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn primary"
          onClick={save}
          disabled={!Number(form.amount) || !form.accountId || !form.paidTo.trim()}
        >
          Record spending
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
