import React, { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { api } from "../lib/api.js";
import { money } from "../lib/format.js";
import { budgetedCategorySpend } from "../lib/budget.js";
import { Empty, Panel } from "../App.jsx";

export default function Budget({ month }) {
  const [cats, setCats] = useState([]),
    [budget, setBudget] = useState({
      month,
      totalLimit: 0,
      categoryLimits: [],
      subcategoryLimits: [],
    }),
    [spend, setSpend] = useState({}),
    [saving, setSaving] = useState(false),
    [msg, setMsg] = useState("");
  const load = async () => {
    const [cs, b, tx] = await Promise.all([
      api.get("/api/categories"),
      api.get(`/api/budgets/${month}`),
      api.get(
        `/api/transactions?from=${month}-01T00:00:00.000Z&to=${nextMonth(month)}-01T00:00:00.000Z&limit=1000`,
      ),
    ]);
    setCats(cs);
    const currentBudget =
      b || { month, totalLimit: 0, categoryLimits: [], subcategoryLimits: [] };
    setBudget(currentBudget);
    setSpend(budgetedCategorySpend(tx, cs, currentBudget.categoryLimits));
  };
  useEffect(() => {
    load().catch((e) => setMsg(e.message));
  }, [month]);
  const parents = cats.filter((c) => c.type === "expense" && !c.parentId),
    subs = (id) => cats.filter((c) => String(c.parentId) === String(id));
  const catLimit = (id) =>
    budget.categoryLimits.find((x) => String(x.categoryId) === String(id))
      ?.amount || 0;
  const totalBudget = parents.reduce(
    (total, category) => total + catLimit(category._id),
    0,
  );
  const setCat = (id, val) => {
    const rest = budget.categoryLimits.filter(
      (x) => String(x.categoryId) !== String(id),
    );
    setBudget({
      ...budget,
      categoryLimits:
        val === "" ? rest : [...rest, { categoryId: id, amount: Number(val) }],
    });
  };
  const totalSpent = Object.values(spend).reduce((s, v) => s + v, 0);
  const pct = totalBudget ? (totalSpent / totalBudget) * 100 : 0;
  const overallSegments = parents
    .map((category) => ({
      id: category._id,
      name: category.name,
      amount: parentSpend(category),
      color: category.color,
    }))
    .filter((segment) => segment.amount > 0);
  const overallSegmentScale =
    totalSpent > totalBudget && totalSpent > 0 ? totalBudget / totalSpent : 1;
  const save = async () => {
    try {
      setSaving(true);
      await api.put(`/api/budgets/${month}`, {
        ...budget,
        totalLimit: totalBudget,
      });
      setMsg("Budget saved");
      setTimeout(() => setMsg(""), 1800);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <div className="page-actions">
        <button className="btn primary" onClick={save} disabled={saving}>
          <Save size={16} /> {saving ? "Saving…" : "Save budget"}
        </button>
      </div>
      {msg && <div className="notice">{msg}</div>}
      <Panel
        title="Overall monthly budget"
        action={<span className="muted">Sum of category budgets</span>}
      >
        <div className="budget-total-row">
          <div>
            <span className="muted">Total spent</span>
            <div className="budget-total-amount">
              {money(totalSpent)} <span>/ {money(totalBudget)}</span>
            </div>
          </div>
          <div className="muted">Set limits in the categories below</div>
        </div>
        <div
          className="progress-track giant"
          role="img"
          aria-label={`Overall: ${money(totalSpent)} spent of ${money(totalBudget)} monthly budget`}
          title={`Overall: ${money(totalSpent)} spent of ${money(totalBudget)} monthly budget`}
          style={{ height: 24, display: "flex" }}
        >
          {overallSegments.map((segment, index) => (
            <div
              className="progress-fill"
              key={segment.id}
              title={`${segment.name}: ${money(segment.amount)} spent`}
              style={{
                width: `${(segment.amount * overallSegmentScale * 100) / (totalBudget || 1)}%`,
                background: segment.color,
                borderRadius:
                  index === 0 || index === overallSegments.length - 1 ? 6 : 0,
                flexShrink: 0,
              }}
            />
          ))}
        </div>
        <div className="row-between tiny muted">
          <span>
            {totalBudget
              ? pct > 100
                ? `${pct.toFixed(0)}% used · ${money(totalSpent - totalBudget)} over budget`
                : `${pct.toFixed(0)}% used`
              : "Set category budgets"}
          </span>
          <span>
            {money(Math.max(0, totalBudget - totalSpent))} remaining
          </span>
        </div>
      </Panel>
      <Panel title="Monthly category budgets">
        {parents.length ? (
          parents.map((p) => {
            const segments = categorySegments(p);
            return (
              <div className="budget-category" key={p._id}>
                <div className="budget-category-head">
                  <div>
                    <span className="dot" style={{ background: p.color }} />
                    {p.name}
                  </div>
                  <label className="budget-input-row">
                    <span className="muted">Monthly budget</span>
                    <input
                      className="manual-budget-input"
                      type="number"
                      min="0"
                      onWheel={(e) => e.currentTarget.blur()}
                      aria-label={`${p.name} monthly budget`}
                      value={catLimit(p._id) || ""}
                      onChange={(e) => setCat(p._id, e.target.value)}
                    />
                  </label>
                </div>
                <div className="row-between tiny muted">
                  <span>Spent {money(parentSpend(p))}</span>
                  <span>
                    {catLimit(p._id)
                      ? `${Math.min(100, (parentSpend(p) / catLimit(p._id)) * 100).toFixed(0)}% of ${money(catLimit(p._id))}`
                      : "Set a monthly budget"}
                  </span>
                </div>
                <div
                  className="progress-track"
                  role="img"
                  aria-label={`${p.name}: ${money(parentSpend(p))} spent of ${money(catLimit(p._id))} monthly budget`}
                  title={`${p.name}: ${money(parentSpend(p))} spent of ${money(catLimit(p._id))} monthly budget`}
                  style={{ height: 24, display: "flex", marginTop: 8 }}
                >
                  {segments.map((segment, index) => (
                    <div
                      className="progress-fill"
                      key={segment.id}
                      title={`${segment.name}: ${money(segment.amount)}`}
                      style={{
                        width: `${segment.width}%`,
                        background: segment.color,
                        borderRadius:
                          index === 0 || index === segments.length - 1 ? 6 : 0,
                        flexShrink: 0,
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })
        ) : (
          <Empty
            title="No expense categories"
            text="Create categories first, then budgets will appear here."
          />
        )}
      </Panel>
    </>
  );
  function parentSpend(p) {
    return Object.entries(spend)
      .filter(
        ([key]) =>
          cats.some(
            (c) =>
              String(c._id) === String(key) &&
              String(c.parentId) === String(p._id),
          ) || String(key) === String(p._id),
      )
      .reduce((s, [, v]) => s + v, 0);
  }

  function categorySegments(p) {
    const limit = catLimit(p._id);
    if (!limit) return [];

    const segments = [
      { id: p._id, name: p.name, amount: spend[p._id] || 0, color: p.color },
      ...subs(p._id).map((s) => ({
        id: s._id,
        name: s.name,
        amount: spend[s._id] || 0,
        color: s.color,
      })),
    ].filter((segment) => segment.amount > 0);
    const total = segments.reduce((sum, segment) => sum + segment.amount, 0);
    const scale = total > limit ? limit / total : 1;

    return segments.map((segment) => ({
      ...segment,
      width: (segment.amount / limit) * scale * 100,
    }));
  }
}
function nextMonth(month) {
  const d = new Date(`${month}-01T00:00:00`);
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
