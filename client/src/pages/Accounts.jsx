import React, { useEffect, useMemo, useState } from "react";
import { CreditCard, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { api } from "../lib/api.js";
import { money } from "../lib/format.js";
import { Empty, Modal, Panel } from "../App.jsx";

const blank = {
  name: "",
  type: "bank",
  color: "#6D63D9",
  logo: "",
  creditLimit: "",
  dueDate: "",
  billingDate: "",
  paymentAccountId: "",
  autoPayEnabled: false,
};
export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");
  const [logoError, setLogoError] = useState("");
  const load = () =>
    api
      .get("/api/accounts")
      .then(setAccounts)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  const banks = accounts.filter((a) => a.type !== "credit_card");
  const open = (a) => {
    setLogoError("");
    setEditing(a || {});
    setForm(
      a
        ? {
            ...a,
            creditLimit: a.creditLimit ?? "",
            dueDate: a.dueDate ?? "",
            billingDate: a.billingDate ?? "",
            paymentAccountId: a.paymentAccountId ?? "",
            autoPayEnabled: a.autoPayEnabled ?? false,
            currentBalance: a.type === "credit_card" ? "" : a.balance,
          }
        : blank,
    );
  };
  const uploadLogo = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
        setLogoError("Choose a PNG, JPEG, or WebP image.");
        return;
    }
    if (file.size > 2 * 1024 * 1024) {
        setLogoError("Logo images must be 2 MB or smaller.");
        return;
    }
    try {
        const logo = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error("Could not read the image."));
          reader.readAsDataURL(file);
        });
        setForm((current) => ({ ...current, logo }));
        setLogoError("");
    } catch (e) {
        setLogoError(e.message);
    }
  };
  const save = async () => {
    try {
      const { currentBalance, ...accountForm } = form;
      const payload = {
        ...accountForm,
        creditLimit:
          form.type === "credit_card" ? Number(form.creditLimit) || 0 : null,
        dueDate:
          form.type === "credit_card" ? Number(form.dueDate) || null : null,
        billingDate:
          form.type === "credit_card" ? Number(form.billingDate) || null : null,
        paymentAccountId:
          form.type === "credit_card" ? form.paymentAccountId || null : null,
        autoPayEnabled:
          form.type === "credit_card" && Boolean(form.autoPayEnabled),
        ...(editing?._id && form.type !== "credit_card"
          ? { currentBalance: Number(currentBalance) }
          : {}),
      };
      if (editing?._id) await api.put(`/api/accounts/${editing._id}`, payload);
      else await api.post("/api/accounts", payload);
      setEditing(null);
      load();
    } catch (e) {
      setError(e.message);
    }
  };
  const remove = async (a) => {
    if (!confirm(`Delete ${a.name}?`)) return;
    try {
      await api.del(`/api/accounts/${a._id}`);
      load();
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <>
      <div className="page-actions">
        <div>
          <span className="muted">Real money locations</span>
        </div>
        <button className="btn primary" onClick={() => open(null)}>
          <Plus size={17} /> Add account
        </button>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="account-grid">
        {accounts.map((a) => (
          <div className="account-detail-card" key={a._id}>
            <div className="row-between">
              <div
                className="account-icon"
                style={{ background: a.color + "18", color: a.color }}
              >
                {a.logo ? (
                  <img className="account-logo" src={a.logo} alt={`${a.name} logo`} />
                ) : a.type === "credit_card" ? (
                  <CreditCard size={19} />
                ) : (
                  <Wallet size={19} />
                )}
              </div>
              <div className="actions">
                <button className="icon-btn" onClick={() => open(a)}>
                  <Pencil size={16} />
                </button>
                <button className="icon-btn danger" onClick={() => remove(a)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <h3>{a.name}</h3>
            <span className="muted capitalize">{a.type.replace("_", " ")}</span>
            {a.type === "credit_card" ? (
              <>
                <div className="card-stat">
                  <span>Owed</span>
                  <strong>{money(a.owed)}</strong>
                </div>
                <div className="card-stat">
                  <span>Available</span>
                  <strong>
                    {a.available == null ? "—" : money(a.available)}
                  </strong>
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
                    (x) => String(x._id) === String(a.paymentAccountId),
                  )?.name || "—"}
                </div>
                {a.autoPayEnabled && (
                  <div className="muted tiny">
                    Automatic payment recording enabled
                  </div>
                )}
              </>
            ) : (
              <div className="account-balance">{money(a.balance)}</div>
            )}
          </div>
        ))}
      </div>
      {!accounts.length && (
        <Empty
          title="No accounts yet"
          text="Create the accounts where your real money lives."
          action={
            <button className="btn primary" onClick={() => open(null)}>
              Add account
            </button>
          }
        />
      )}
      {editing && (
        <Modal
          title={editing._id ? "Edit account" : "Add account"}
          onClose={() => {
            setEditing(null);
            setLogoError("");
          }}
        >
          {logoError && <div className="error">{logoError}</div>}
          <div className="form-grid">
            <Field label="Name">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="ICICI Salary"
                autoFocus
              />
            </Field>
            <Field label="Type">
              <select
                value={form.type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    type: e.target.value,
                    currentBalance:
                      e.target.value === "credit_card"
                        ? ""
                        : form.currentBalance ?? 0,
                  })
                }
              >
                <option value="bank">Bank</option>
                <option value="credit_card">Credit card</option>
                <option value="cash">Cash</option>
                <option value="investment">Investment</option>
                <option value="other">Other</option>
              </select>
            </Field>
            {editing?._id && form.type !== "credit_card" && (
              <Field label="Current amount">
                <input
                  type="number"
                  step="0.01"
                  value={form.currentBalance}
                  onChange={(e) =>
                    setForm({ ...form, currentBalance: e.target.value })
                  }
                />
                <small className="muted">
                  Adjusts the current balance without changing transaction history.
                </small>
              </Field>
            )}
            {form.type === "credit_card" && (
              <>
                <Field label="Credit limit">
                  <input
                    type="number"
                    min="0"
                    value={form.creditLimit}
                    onChange={(e) =>
                      setForm({ ...form, creditLimit: e.target.value })
                    }
                  />
                </Field>
                <Field label="Billing day">
                  <select
                    value={form.billingDate || ""}
                    onChange={(e) =>
                      setForm({ ...form, billingDate: e.target.value })
                    }
                  >
                    <option value="">Select billing day</option>
                    {dayOptions().map((day) => (
                      <option key={day} value={day}>
                        {ordinal(day)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Payment due day">
                  <select
                    value={form.dueDate || ""}
                    onChange={(e) =>
                      setForm({ ...form, dueDate: e.target.value })
                    }
                  >
                    <option value="">Select due day</option>
                    {dayOptions().map((day) => (
                      <option key={day} value={day}>
                        {ordinal(day)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Payment account">
                  <select
                    value={form.paymentAccountId || ""}
                    onChange={(e) =>
                      setForm({ ...form, paymentAccountId: e.target.value })
                    }
                  >
                    <option value="">Select bank account</option>
                    {banks
                      .filter((b) => b._id !== editing?._id)
                      .map((b) => (
                        <option key={b._id} value={b._id}>
                          {b.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Automatic payment">
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontWeight: 400,
                    }}
                  >
                    <input
                      type="checkbox"
                      style={{ width: "auto" }}
                      checked={Boolean(form.autoPayEnabled)}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          autoPayEnabled: e.target.checked,
                        })
                      }
                    />
                    Automatically record the statement payment on the due date
                  </label>
                  <small className="muted">
                    Starts on the next due date on or after enabling. Records a
                    transfer here; it does not send money or contact your bank.
                  </small>
                </Field>
              </>
            )}
            <Field label="Accent color">
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
              />
            </Field>
            <Field label="Bank or account logo">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={uploadLogo}
              />
              <small className="muted">PNG, JPEG, or WebP; maximum 2 MB.</small>
              {form.logo && (
                <div className="logo-preview">
                  <img className="account-logo" src={form.logo} alt="Logo preview" />
                  <button
                    className="btn small"
                    type="button"
                    onClick={() => {
                      setForm({ ...form, logo: "" });
                      setLogoError("");
                    }}
                  >
                    Remove logo
                  </button>
                </div>
              )}
            </Field>
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button
              className="btn primary"
              onClick={save}
              disabled={!form.name.trim()}
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
function dayOptions() {
  return Array.from({ length: 31 }, (_, i) => i + 1);
}
function ordinal(n) {
  const d = Number(n);
  if (!d) return "—";
  const s = ["th", "st", "nd", "rd"];
  const v = d % 100;
  return `${d}${s[(v - 20) % 10] || s[v] || s[0]}`;
}
function formatDay(day) {
  return day == null || day === "" ? "—" : `${ordinal(day)} of month`;
}
function formatDate(value) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}
