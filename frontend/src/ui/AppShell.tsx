import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { useMonthSelection } from "../state/MonthContext";

const navItems = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/reports", label: "Reports" },
  { to: "/transactions", label: "Transactions" },
  { to: "/imports", label: "Imports" },
  { to: "/accounts", label: "Accounts" },
  { to: "/budgets", label: "Budgets" },
  { to: "/categories", label: "Categories" },
  { to: "/settings", label: "Settings" }
];

export function AppShell({ children }: { children: ReactNode }) {
  const { auth, logout } = useAuth();
  const { selectedMonth, setSelectedMonth, goToPreviousMonth, goToNextMonth, goToCurrentMonth } = useMonthSelection();

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link to="/dashboard" className="brand">
          <span className="brand-mark">L</span>
          <div>
            <strong>Ledgerra</strong>
            <p>Calm money planning</p>
          </div>
        </Link>

        <nav className="nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
            >
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="month-panel">
          <label htmlFor="global-month">Month</label>
          <div className="month-controls">
            <button className="ghost-button compact-button" type="button" onClick={goToPreviousMonth} aria-label="Previous month">
              &lt;
            </button>
            <input
              id="global-month"
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
            />
            <button className="ghost-button compact-button" type="button" onClick={goToNextMonth} aria-label="Next month">
              &gt;
            </button>
          </div>
          <button className="ghost-button month-today-button" type="button" onClick={goToCurrentMonth}>
            Current month
          </button>
        </div>

        <div className="sidebar-footer account-panel">
          <div>
            <small>Signed in as</small>
            <strong>{auth?.email}</strong>
          </div>
          <button className="ghost-button" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="content">{children}</main>
    </div>
  );
}
