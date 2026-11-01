import React, { useEffect, useMemo, useState } from "react";
import { UserButton, useUser } from "@clerk/react";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  CircleDollarSign,
  LayoutDashboard,
  Menu,
  Repeat2,
  Settings as SettingsIcon,
  Target,
  Tags,
  WalletCards,
  X,
} from "lucide-react";
import Dashboard from "./pages/Dashboard.jsx";
import Accounts from "./pages/Accounts.jsx";
import Transactions from "./pages/Transactions.jsx";
import Budget from "./pages/Budget.jsx";
import Goals from "./pages/Goals.jsx";
import Funds from "./pages/Funds.jsx";
import Recurring from "./pages/Recurring.jsx";
import Categories from "./pages/Categories.jsx";
import Settings from "./pages/Settings.jsx";
import { api } from "./lib/api.js";
import { monthInput } from "./lib/format.js";

const nav = [
  ["/", "Dashboard", LayoutDashboard],
  ["/accounts", "Accounts", WalletCards],
  ["/transactions", "Transactions", CreditCard],
  ["/budget", "Budget", BarChart3],
  ["/goals", "Saving goals", Target],
  ["/funds", "Funds", CircleDollarSign],
  ["/recurring", "Recurring", Repeat2],
  ["/categories", "Categories", Tags],
  ["/settings", "Settings", SettingsIcon],
];

export default function App() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [month, setMonth] = useState(monthInput());
  const [theme, setTheme] = useState("light");
  const [displayName, setDisplayName] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const location = useLocation();
  const { user } = useUser();

  useEffect(() => {
    api
      .get("/api/settings")
      .then((settings) => {
        setTheme(settings.theme || "light");
        setDisplayName(settings.displayName || user?.fullName || "");
      })
      .catch((error) => setSettingsError(error.message));
  }, [user?.fullName]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => setMobileOpen(false), [location.pathname]);
  useEffect(() => {
    document.title = displayName
      ? `${displayName}'s Finance`
      : "Personal Finance";
  }, [displayName]);

  const shiftMonth = (amount) => {
    const d = new Date(`${month}-01T00:00:00`);
    d.setMonth(d.getMonth() + amount);
    setMonth(monthInput(d));
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">₹</div>
          <div>
            <strong>{displayName ? `${displayName}'s Finance` : "My Finance"}</strong>
            <span>Private workspace</span>
          </div>
          <button
            className="icon-btn mobile-close"
            onClick={() => setMobileOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
        <nav className="nav-list">
          {nav.map(([to, label, Icon]) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
              end={to === "/"}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">INR · Private</div>
      </aside>
      {mobileOpen && (
        <div className="mobile-backdrop" onClick={() => setMobileOpen(false)} />
      )}
      <main className="main-area">
        <header className="topbar">
          <button
            className="icon-btn mobile-menu"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="page-title">
            <span className="eyebrow">Personal finance</span>
            <h1>
              {nav.find(([to]) => to === location.pathname)?.[1] || "Dashboard"}
            </h1>
          </div>
          {["/", "/budget", "/transactions"].includes(location.pathname) && (
            <div className="month-picker">
              <button className="icon-btn" onClick={() => shiftMonth(-1)}>
                <ChevronLeft size={18} />
              </button>
              <span>
                {new Date(`${month}-01T00:00:00`).toLocaleDateString("en-IN", {
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <button className="icon-btn" onClick={() => shiftMonth(1)}>
                <ChevronRight size={18} />
              </button>
            </div>
          )}
          <UserButton />
        </header>
        <div className="content">
          {settingsError && <div className="error">{settingsError}</div>}
          <Routes>
            <Route path="/" element={<Dashboard month={month} />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route
              path="/transactions"
              element={<Transactions month={month} />}
            />
            <Route path="/budget" element={<Budget month={month} />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/funds" element={<Funds />} />
            <Route path="/recurring" element={<Recurring />} />
            <Route path="/categories" element={<Categories />} />
            <Route
              path="/settings"
              element={
                <Settings
                  theme={theme}
                  setTheme={setTheme}
                  displayName={displayName}
                  userName={user?.fullName || ""}
                  onDisplayNameChange={setDisplayName}
                />
              }
            />
            <Route path="*" element={<Dashboard month={month} />} />
          </Routes>
        </div>
        <nav
          className="mobile-nav"
          style={{ gridTemplateColumns: "repeat(6, 1fr)" }}
        >
          {nav.slice(0, 6).map(([to, label, Icon]) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => (isActive ? "active" : "")}
              end={to === "/"}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </main>
    </div>
  );
}

export function Panel({ title, action, children, className = "" }) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Modal({ title, children, onClose, wide = false }) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.currentTarget === e.target && onClose()}
    >
      <div className={`modal ${wide ? "wide" : ""}`}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Empty({
  title = "No data yet",
  text = "Add something to get started.",
  action,
}) {
  return (
    <div className="empty">
      <div className="empty-icon">○</div>
      <strong>{title}</strong>
      <span>{text}</span>
      {action}
    </div>
  );
}
