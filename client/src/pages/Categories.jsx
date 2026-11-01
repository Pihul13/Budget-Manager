import React, { useEffect, useState } from "react";
import { ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "../lib/api.js";
import { Empty, Modal } from "../App.jsx";

const blank = { name: "", type: "expense", parentId: "", color: "#6D63D9" };
const subcategoryColors = [
  "#6D63D9",
  "#2A9D8F",
  "#E9A23B",
  "#E76F51",
  "#4D83D8",
  "#C65DB3",
  "#7BAE4A",
];
export default function Categories() {
  const [cats, setCats] = useState([]),
    [editing, setEditing] = useState(null),
    [selectedParent, setSelectedParent] = useState(null),
    [form, setForm] = useState(blank),
    [error, setError] = useState("");
  const load = () =>
    api
      .get("/api/categories")
      .then(setCats)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  const open = (c) => {
    setEditing(c || {});
    setForm(c ? { ...c, parentId: c.parentId || "" } : blank);
  };
  const parents = cats.filter((c) => !c.parentId);
  const children = (parent) =>
    cats.filter((c) => String(c.parentId) === String(parent._id));
  const save = async () => {
    try {
      if (form.parentId && String(form.parentId) === String(editing?._id))
        throw new Error("A category cannot be its own parent.");
      if (editing?._id) await api.put(`/api/categories/${editing._id}`, form);
      else await api.post("/api/categories", form);
      setEditing(null);
      load();
    } catch (e) {
      setError(e.message);
    }
  };
  const del = async (c) => {
    if (!confirm(`Delete ${c.name}?`)) return;
    try {
      await api.del(`/api/categories/${c._id}`);
      load();
    } catch (e) {
      setError(e.message);
    }
  };
  const section = (type, label) => (
    <section className="panel category-section">
      <div className="panel-head">
        <h2>{label}</h2>
        <button className="btn small" onClick={() => open({ ...blank, type })}>
          <Plus size={15} /> Add
        </button>
      </div>
      {parents
        .filter((p) => p.type === type)
        .map((p) => (
          <div className="category-tree" key={p._id}>
            <div className="category-line">
              <div>
                <span className="dot" style={{ background: p.color }} />
                {p.name}
              </div>
              <div className="actions">
                <button className="icon-btn" onClick={() => open(p)}>
                  <Pencil size={15} />
                </button>
                <button className="icon-btn danger" onClick={() => del(p)}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
            <button
              className="btn small"
              onClick={() => setSelectedParent(p)}
              aria-label={`Show subcategories for ${p.name}`}
            >
              <ChevronDown size={14} />
              Subcategories ({children(p).length})
            </button>
          </div>
        ))}
      {parents.filter((p) => p.type === type).length === 0 && (
        <Empty
          title={`No ${label.toLowerCase()}`}
          text="Create your own categories."
        />
      )}
    </section>
  );
  return (
    <>
      <div className="page-actions">
        <div>
          <span className="muted">Fully customizable</span>
        </div>
        <button className="btn primary" onClick={() => open(null)}>
          <Plus size={17} /> Add category
        </button>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="grid-2">
        {section("expense", "Expense categories")}
        {section("income", "Income categories")}
      </div>
      {selectedParent && (
        <Modal
          title={`${selectedParent.name} subcategories`}
          onClose={() => setSelectedParent(null)}
        >
          <div className="panel-head">
            <span className="muted">Under {selectedParent.name}</span>
            <button
              className="btn small"
              onClick={() =>
                open({
                  ...blank,
                  type: selectedParent.type,
                  parentId: selectedParent._id,
                })
              }
            >
              <Plus size={15} /> Add subcategory
            </button>
          </div>
          {children(selectedParent).length > 0 ? (
            children(selectedParent).map((c) => (
              <div className="category-line sub" key={c._id}>
                <div>
                  <span className="subdot" />
                  {c.name}
                </div>
                <div className="actions">
                  <button className="icon-btn" onClick={() => open(c)}>
                    <Pencil size={14} />
                  </button>
                  <button className="icon-btn danger" onClick={() => del(c)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <Empty
              title="No subcategories yet"
              text={`Add a subcategory under ${selectedParent.name}.`}
            />
          )}
        </Modal>
      )}
      {editing && (
        <Modal
          title={editing._id ? "Edit category" : "Add category"}
          onClose={() => setEditing(null)}
        >
          <div className="form-grid">
            <Field label="Name">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoFocus
              />
            </Field>
            <Field label="Type">
              <select
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value, parentId: "" })
                }
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </Field>
            <Field label="Parent category">
              <select
                value={form.parentId || ""}
                onChange={(e) => {
                  const parentId = e.target.value;
                  const siblingColors = cats
                    .filter((c) => String(c.parentId) === parentId)
                    .map((c) => c.color?.toLowerCase());
                  const color =
                    !editing?._id && parentId
                      ? subcategoryColors.find(
                          (candidate) =>
                            !siblingColors.includes(candidate.toLowerCase()),
                        ) ||
                        subcategoryColors[
                          siblingColors.length % subcategoryColors.length
                        ]
                      : form.color;
                  setForm({ ...form, parentId, color });
                }}
              >
                <option value="">Top-level category</option>
                {parents
                  .filter(
                    (p) =>
                      p.type === form.type && p._id !== editing?._id,
                  )
                  .map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
              </select>
              <small className="muted">
                Choose a parent category here to create a subcategory.
              </small>
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
