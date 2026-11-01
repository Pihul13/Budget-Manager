import React, { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  Clock3,
  Pencil,
  Plus,
  Trash2,
  WalletCards,
} from "lucide-react";
import { api } from "../lib/api.js";
import { dateInput, money } from "../lib/format.js";
import { Empty, Modal } from "../App.jsx";
import FundSpendModal from "../components/FundSpendModal.jsx";
import ReallocationModal from "../components/ReallocationModal.jsx";

const blankFund = { name: "", color: "#6D63D9" };
const blankEntry = () => ({
  amount: "",
  fromAccountId: "",
  toAccountId: "",
  date: dateInput(),
  description: "",
  note: "",
});

export default function Funds() {
  const [funds, setFunds] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankFund);
  const [entryFund, setEntryFund] = useState(null);
  const [entry, setEntry] = useState(blankEntry);
  const [history, setHistory] = useState(null);
  const [spendingFund, setSpendingFund] = useState(null);
  const [reallocationFund, setReallocationFund] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const [nextFunds, nextAccounts] = await Promise.all([
        api.get("/api/funds"),
        api.get("/api/accounts"),
      ]);
      setFunds(nextFunds);
      setAccounts(nextAccounts);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openFund = (fund) => {
    setEditing(fund || {});
    setForm(fund ? { name: fund.name, color: fund.color } : blankFund);
  };

  const saveFund = async () => {
    try {
      if (editing?._id) await api.put(`/api/funds/${editing._id}`, form);
      else await api.post("/api/funds", form);
      setEditing(null);
      setError("");
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const deleteFund = async (fund) => {
    if (!confirm(`Delete the ${fund.name} fund?`)) return;
    try {
      await api.del(`/api/funds/${fund._id}`);
      setError("");
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const openEntry = (fund) => {
    const sourceAccountId = accounts[0]?._id || "";
    setEntryFund(fund);
    setEntry({
      ...blankEntry(),
      fromAccountId: sourceAccountId,
      toAccountId:
        accounts.find((account) => account._id !== sourceAccountId)?._id || "",
    });
  };

  const saveEntry = async () => {
    try {
      await api.post("/api/transactions", {
        type: "transfer",
        amount: Number(entry.amount),
        fromAccountId: entry.fromAccountId,
        toAccountId: entry.toAccountId,
        date: entry.date,
        description:
          entry.description.trim() ||
          `Contribution to ${entryFund.name}`,
        note: entry.note,
        fundId: entryFund._id,
        fundAction: "contribution",
      });
      setEntryFund(null);
      setError("");
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const showHistory = async (fund) => {
    try {
      setHistory({
        fund,
        entries: await api.get(`/api/funds/${fund._id}/history`),
      });
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <>
      <div className="page-actions">
        <div>
          <span className="muted">Ongoing balances without a target</span>
        </div>
        <button className="btn primary" onClick={() => openFund(null)}>
          <Plus size={17} /> Add fund
        </button>
      </div>
      {error && <div className="error">{error}</div>}
      <p className="hint">
        Funds earmark money held in your real accounts. Add money records a
        transfer into a fund; spending records an expense paid from the account
        holding it.
      </p>

      {funds.length ? (
        <div className="goal-grid">
          {funds.map((fund) => (
            <section className="goal-card" key={fund._id}>
              <div className="row-between">
                <div
                  className="goal-icon large"
                  style={{
                    background: `${fund.color}20`,
                    color: fund.color,
                  }}
                >
                  <WalletCards size={20} />
                </div>
                <div className="actions">
                  <button
                    className="icon-btn"
                    title="Edit fund"
                    onClick={() => openFund(fund)}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="icon-btn danger"
                    title="Delete fund"
                    onClick={() => deleteFund(fund)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <h3>{fund.name}</h3>
              <div className="goal-amount">
                <strong>{money(fund.balance)}</strong>
                <span> earmarked</span>
              </div>
              <div className="fund-storage">
                <span className="muted tiny">Stored in</span>
                {fund.storageByAccount?.length ? (
                  fund.storageByAccount.map((storage) => (
                    <div className="row-between tiny" key={storage.accountId}>
                      <span>{storage.accountName}</span>
                      <strong>{money(storage.amount)}</strong>
                    </div>
                  ))
                ) : (
                  <span className="muted tiny">No money stored yet</span>
                )}
              </div>
              <div className="fund-actions">
                <button
                  className="btn small"
                  onClick={() => openEntry(fund)}
                  disabled={accounts.length < 2}
                >
                  <Plus size={15} /> Add money
                </button>
                <button
                  className="btn small"
                  onClick={() => setSpendingFund(fund)}
                  disabled={!fund.storageByAccount?.length}
                >
                  Spend
                </button>
                <button
                  className="btn small"
                  onClick={() => setReallocationFund(fund)}
                  disabled={!fund.storageByAccount?.length}
                >
                  <ArrowLeftRight size={15} /> Move money
                </button>
                <button
                  className="btn small"
                  title="Fund history"
                  onClick={() => showHistory(fund)}
                >
                  <Clock3 size={15} /> History
                </button>
              </div>
              {accounts.length < 2 && (
                <div className="muted tiny">
                  Add at least two accounts to record fund transfers.
                </div>
              )}
            </section>
          ))}
        </div>
      ) : (
        <Empty
          title="No funds yet"
          text="Create an ongoing fund for family support, gifts, or other uncapped savings."
          action={
            <button className="btn primary" onClick={() => openFund(null)}>
              <Plus size={16} /> Add fund
            </button>
          }
        />
      )}

      {editing && (
        <Modal
          title={editing._id ? "Edit fund" : "Add fund"}
          onClose={() => setEditing(null)}
        >
          <div className="form-grid">
            <Field label="Fund name">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Parents"
                autoFocus
              />
            </Field>
            <Field label="Color">
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
              />
            </Field>
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button
              className="btn primary"
              onClick={saveFund}
              disabled={!form.name.trim()}
            >
              Save fund
            </button>
          </div>
        </Modal>
      )}

      {entryFund && (
        <Modal
          title={`Add money to ${entryFund.name}`}
          onClose={() => setEntryFund(null)}
        >
          <div className="form-grid">
            <Field label="Amount">
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={entry.amount}
                onChange={(e) => setEntry({ ...entry, amount: e.target.value })}
                autoFocus
              />
            </Field>
            <Field label="Date">
              <input
                type="date"
                value={entry.date}
                onChange={(e) => setEntry({ ...entry, date: e.target.value })}
              />
            </Field>
            <Field label="From account">
              <select
                value={entry.fromAccountId}
                onChange={(e) =>
                  setEntry({ ...entry, fromAccountId: e.target.value })
                }
              >
                <option value="">Select account</option>
                {accounts.map((account) => (
                  <option key={account._id} value={account._id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="To account">
              <select
                value={entry.toAccountId}
                onChange={(e) =>
                  setEntry({ ...entry, toAccountId: e.target.value })
                }
              >
                <option value="">Select account</option>
                {accounts.map((account) => (
                  <option key={account._id} value={account._id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Description (optional)">
              <input
                value={entry.description}
                onChange={(e) =>
                  setEntry({ ...entry, description: e.target.value })
                }
              />
            </Field>
            <Field label="Note (optional)">
              <input
                value={entry.note}
                onChange={(e) => setEntry({ ...entry, note: e.target.value })}
              />
            </Field>
          </div>
          <p className="hint">
            This records a real account transfer into the fund and increases
            its earmarked balance.
          </p>
          <div className="modal-actions">
            <button className="btn" onClick={() => setEntryFund(null)}>
              Cancel
            </button>
            <button
              className="btn primary"
              onClick={saveEntry}
              disabled={
                !Number(entry.amount) ||
                !entry.fromAccountId ||
                !entry.toAccountId ||
                entry.fromAccountId === entry.toAccountId
              }
            >
              Save transfer
            </button>
          </div>
        </Modal>
      )}

      {spendingFund && (
        <FundSpendModal
          item={spendingFund}
          kind="fund"
          onClose={() => setSpendingFund(null)}
          onSaved={() => {
            setSpendingFund(null);
            setError("");
            load();
          }}
        />
      )}

      {reallocationFund && (
        <ReallocationModal
          item={reallocationFund}
          kind="fund"
          onClose={() => setReallocationFund(null)}
          onSaved={() => {
            setReallocationFund(null);
            setError("");
            load();
          }}
        />
      )}

      {history && (
        <Modal
          title={`${history.fund.name} history`}
          onClose={() => setHistory(null)}
        >
          {history.entries.length ? (
            <div className="history-list">
              {history.entries.map((record) => (
                <div className="history-row" key={record._id}>
                  <div>
                    <strong>
                      {record.type === "reallocation"
                        ? String(record.fromFundId?._id) ===
                          String(history.fund._id)
                          ? `Moved to ${record.toFundId?.name || record.toGoalId?.name || "another goal"}`
                          : `Moved from ${record.fromFundId?.name || record.fromGoalId?.name || "another goal"}`
                        : record.type === "expense"
                        ? "Spent"
                        : record.fundAction === "withdrawal"
                          ? "Withdrawal"
                          : "Contribution"}
                    </strong>
                    <div className="muted tiny">
                      {new Date(record.date).toLocaleDateString("en-IN")} ·{" "}
                      {record.type === "reallocation"
                        ? record.accountId?.name || "—"
                        : record.type === "expense"
                        ? `${record.accountId?.name || "—"} · paid to ${record.paidTo || "—"}`
                        : `${record.fromAccountId?.name || "—"} → ${record.toAccountId?.name || "—"}`}
                      {record.description ? ` · ${record.description}` : ""}
                    </div>
                  </div>
                  <strong
                    className={
                      record.type === "expense" ||
                      (record.type === "reallocation" &&
                        String(record.fromFundId?._id) ===
                          String(history.fund._id)) ||
                      record.fundAction === "withdrawal"
                        ? ""
                        : "positive"
                    }
                  >
                    {record.type === "expense" ||
                    (record.type === "reallocation" &&
                      String(record.fromFundId?._id) ===
                        String(history.fund._id)) ||
                    record.fundAction === "withdrawal"
                      ? "− "
                      : "+ "}
                    {money(record.amount)}
                  </strong>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="No fund activity" text="Add a contribution to get started." />
          )}
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
