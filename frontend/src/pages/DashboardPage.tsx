import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLedgerraData } from "../hooks/useLedgerraData";
import { PageHeader } from "../ui/PageHeader";
import { MetricCard } from "../ui/MetricCard";
import { SectionCard } from "../ui/SectionCard";
import { EmptyState } from "../ui/EmptyState";
import { formatCurrency } from "../utils/format";

type ChecklistAction =
  | { kind: "button"; label: string; onClick: () => void }
  | { kind: "link"; label: string; to: string }
  | { kind: "done"; label: string };

type ChecklistItem = {
  title: string;
  detail: string;
  complete: boolean;
  actions: ChecklistAction[];
};

type OnboardingAcknowledgements = {
  currency: boolean;
  categories: boolean;
};

const acknowledgementDefaults: OnboardingAcknowledgements = {
  currency: false,
  categories: false
};

function readAcknowledgements(storageKey: string, legacyStorageKey?: string): OnboardingAcknowledgements {
  try {
    const stored = window.localStorage.getItem(storageKey) ?? (legacyStorageKey ? window.localStorage.getItem(legacyStorageKey) : null);
    return stored ? { ...acknowledgementDefaults, ...JSON.parse(stored) } : acknowledgementDefaults;
  } catch {
    return acknowledgementDefaults;
  }
}

export function DashboardPage() {
  const { accounts, dashboard, budget, loading, error, profile, transactions } = useLedgerraData();
  const mainCurrencyCode = profile?.preferredCurrencyCode ?? "USD";
  const acknowledgementStorageKey = `ledgerra:onboarding:${profile?.email ?? "anonymous"}`;
  const legacyAcknowledgementStorageKey = `${acknowledgementStorageKey}:${mainCurrencyCode}`;
  const [acknowledgements, setAcknowledgements] = useState(() =>
    readAcknowledgements(acknowledgementStorageKey, legacyAcknowledgementStorageKey)
  );
  const accountCurrencyCodes = useMemo(
    () => new Map(accounts.map((account) => [account.id, account.currencyCode])),
    [accounts]
  );
  const hasBudget = (budget?.totalPlanned ?? 0) > 0 || Boolean(budget?.categories.some((category) => category.planned > 0));

  const markAcknowledgement = useCallback((key: keyof typeof acknowledgementDefaults) => {
    setAcknowledgements((current) => {
      const next = { ...current, [key]: true };
      window.localStorage.setItem(acknowledgementStorageKey, JSON.stringify(next));
      return next;
    });
  }, [acknowledgementStorageKey]);

  const checklistItems: ChecklistItem[] = useMemo(
    () => [
      {
        title: "Create first account",
        detail: accounts[0] ? accounts[0].name : "Add the account you check most often.",
        complete: accounts.length > 0,
        actions: accounts.length > 0 ? [{ kind: "done", label: "Account ready" }] : [{ kind: "link", label: "Add account", to: "/accounts" }]
      },
      {
        title: "Confirm currency",
        detail: `Use ${mainCurrencyCode} for dashboard totals and budget planning.`,
        complete: acknowledgements.currency,
        actions: acknowledgements.currency
          ? [{ kind: "done", label: "Currency confirmed" }]
          : [{ kind: "button", label: `Confirm ${mainCurrencyCode}`, onClick: () => markAcknowledgement("currency") }]
      },
      {
        title: "Review default categories",
        detail: "Scan the starting income and expense categories before importing data.",
        complete: acknowledgements.categories,
        actions: acknowledgements.categories
          ? [{ kind: "done", label: "Categories reviewed" }]
          : [
              { kind: "link", label: "Open categories", to: "/categories" },
              { kind: "button", label: "Reviewed", onClick: () => markAcknowledgement("categories") }
            ]
      },
      {
        title: "Set first budget",
        detail: "Give your main expense categories a monthly plan.",
        complete: hasBudget,
        actions: hasBudget ? [{ kind: "done", label: "Budget set" }] : [{ kind: "link", label: "Set budget", to: "/budgets" }]
      },
      {
        title: "Add first transaction",
        detail: "Import a statement or add a transaction so the dashboard has real activity.",
        complete: transactions.length > 0,
        actions: transactions.length > 0
          ? [{ kind: "done", label: "Transaction added" }]
          : [{ kind: "link", label: "Add first transaction", to: "/transactions" }]
      }
    ],
    [accounts, acknowledgements, hasBudget, mainCurrencyCode, markAcknowledgement, transactions.length]
  );
  const completedChecklistItems = checklistItems.filter((item) => item.complete).length;
  const isChecklistComplete = completedChecklistItems === checklistItems.length;

  useEffect(() => {
    const nextAcknowledgements = readAcknowledgements(acknowledgementStorageKey, legacyAcknowledgementStorageKey);
    setAcknowledgements(nextAcknowledgements);
    window.localStorage.setItem(acknowledgementStorageKey, JSON.stringify(nextAcknowledgements));
  }, [acknowledgementStorageKey, legacyAcknowledgementStorageKey]);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Overview"
        title="Money at a glance"
        description="See the month’s inflow, spending rhythm, and remaining budget without noise."
      />

      {error ? <p className="error-banner">{error}</p> : null}

      {!isChecklistComplete ? (
        <section className="onboarding-checklist" aria-label="Onboarding checklist">
          <div className="onboarding-checklist-header">
            <div>
              <span className="eyebrow">Next steps</span>
              <h2>First run checklist</h2>
              <p>Move from an empty ledger to a useful monthly view.</p>
            </div>
            <strong>{completedChecklistItems} of {checklistItems.length} complete</strong>
          </div>
          <div className="onboarding-checklist-items">
            {checklistItems.map((item) => (
              <article className={`onboarding-checklist-item${item.complete ? " is-complete" : ""}`} key={item.title}>
                <span className="checkmark" aria-hidden="true">
                  {item.complete ? "✓" : ""}
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
                <div className="onboarding-checklist-actions">
                  {item.actions.map((action) =>
                    action.kind === "link" ? (
                      <Link className="ghost-button compact-button" key={action.label} to={action.to}>
                        {action.label}
                      </Link>
                    ) : action.kind === "button" ? (
                      <button className="ghost-button compact-button" key={action.label} onClick={action.onClick} type="button">
                        {action.label}
                      </button>
                    ) : (
                      <span className="status-badge success" key={action.label}>
                        {action.label}
                      </span>
                    )
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className="metric-grid">
        <MetricCard
          label="Income"
          value={formatCurrency(dashboard?.income ?? 0, mainCurrencyCode)}
          tone="positive"
          detail="All monthly inflows."
        />
        <MetricCard
          label="Expenses"
          value={formatCurrency(dashboard?.expenses ?? 0, mainCurrencyCode)}
          tone="negative"
          detail="Transfers excluded."
        />
        <MetricCard
          label="Net"
          value={formatCurrency(dashboard?.net ?? 0, mainCurrencyCode)}
          tone={(dashboard?.net ?? 0) >= 0 ? "positive" : "negative"}
          detail="Income minus expenses."
        />
        <MetricCard
          label="Budget Remaining"
          value={formatCurrency(budget?.totalRemaining ?? dashboard?.budgetRemaining ?? 0, mainCurrencyCode)}
          detail="Across tracked budget categories."
        />
      </div>

      <div className="dashboard-grid">
        <SectionCard title="Top categories">
          {!dashboard?.topCategories.length ? (
            <EmptyState
              title={loading ? "Loading spending…" : "No spending yet"}
              body="Add transactions to see which categories are shaping the month."
            />
          ) : (
            <div className="bar-list">
              {dashboard.topCategories.map((category) => {
                const largest = dashboard.topCategories[0]?.amount ?? 1;
                const width = `${Math.max((category.amount / largest) * 100, 12)}%`;

                return (
                  <div className="bar-item" key={category.categoryId}>
                    <div>
                      <strong>{category.categoryName}</strong>
                      <span>{formatCurrency(category.amount, mainCurrencyCode)}</span>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Account balances">
          {!dashboard?.accounts.length ? (
            <EmptyState
              title={loading ? "Loading accounts…" : "No accounts yet"}
              body="Create a personal, joint, or savings account to begin tracking."
            />
          ) : (
            <div className="account-balance-list">
              {dashboard.accounts.map((account) => (
                <article key={account.accountId} className="balance-row">
                  <div>
                    <strong>{account.name}</strong>
                    <p>Live balance</p>
                  </div>
                  <strong>{formatCurrency(account.balance, accountCurrencyCodes.get(account.accountId) ?? mainCurrencyCode)}</strong>
                </article>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
