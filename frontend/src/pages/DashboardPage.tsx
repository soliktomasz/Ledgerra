import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLedgerraData } from "../hooks/useLedgerraData";
import { PageHeader } from "../ui/PageHeader";
import { MetricCard } from "../ui/MetricCard";
import { SectionCard } from "../ui/SectionCard";
import { EmptyState } from "../ui/EmptyState";
import { formatCurrency } from "../utils/format";
import type { BudgetSummary, Transaction } from "../types";

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

type DashboardInsight = {
  id: string;
  title: string;
  detail: string;
  tone: "attention" | "warning" | "neutral";
  action?: {
    label: string;
    to: string;
  };
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

function pluralize(count: number, singular: string, plural: string) {
  return count === 1 ? singular : plural;
}

function buildDashboardInsights(
  budget: BudgetSummary | null,
  transactions: Transaction[],
  currencyCode: string
): DashboardInsight[] {
  const insights: DashboardInsight[] = [];
  const budgetCategories = budget?.categories ?? [];
  const hasBudget = (budget?.totalPlanned ?? 0) > 0 || budgetCategories.some((category) => category.planned > 0);
  const expenseTransactions = transactions.filter((transaction) => transaction.type === "Expense");
  const uncategorizedExpenseCount = expenseTransactions.filter((transaction) => !transaction.categoryId).length;

  budgetCategories
    .filter((category) => category.planned > 0 && category.remaining < 0)
    .sort((left, right) => left.remaining - right.remaining)
    .slice(0, 2)
    .forEach((category) => {
      insights.push({
        id: `over-budget-${category.categoryId}`,
        title: `${category.categoryName} needs attention`,
        detail: `${category.categoryName} is over budget by ${formatCurrency(Math.abs(category.remaining), currencyCode)}.`,
        tone: "warning",
        action: { label: "Open budgets", to: "/budgets" }
      });
    });

  budgetCategories
    .filter((category) => category.planned > 0 && category.remaining >= 0)
    .map((category) => ({
      ...category,
      percentUsed: Math.round((category.spent / category.planned) * 100)
    }))
    .filter((category) => category.percentUsed >= 80)
    .sort((left, right) => right.percentUsed - left.percentUsed)
    .slice(0, 2)
    .forEach((category) => {
      insights.push({
        id: `budget-pressure-${category.categoryId}`,
        title: `${category.categoryName} is close to its limit`,
        detail: `${category.categoryName} is ${category.percentUsed}% of its budget.`,
        tone: "attention",
        action: { label: "Open budgets", to: "/budgets" }
      });
    });

  if (uncategorizedExpenseCount > 0) {
    insights.push({
      id: "uncategorized-expenses",
      title: "Categorize recent spending",
      detail: `You have ${uncategorizedExpenseCount} uncategorized ${pluralize(uncategorizedExpenseCount, "expense transaction", "expense transactions")}.`,
      tone: "attention",
      action: { label: "Review transactions", to: "/transactions?view=uncategorized" }
    });
  }

  if (!hasBudget && transactions.length > 0) {
    insights.push({
      id: "set-budget",
      title: "Add budget guardrails",
      detail: "Set a monthly budget to turn spending into progress alerts.",
      tone: "neutral",
      action: { label: "Open budgets", to: "/budgets" }
    });
  }

  return insights.slice(0, 4);
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
  const insights = useMemo(
    () => buildDashboardInsights(budget, transactions, mainCurrencyCode),
    [budget, mainCurrencyCode, transactions]
  );

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

      {insights.length > 0 ? (
        <section className="insights-panel" aria-label="Dashboard insights">
          <div className="section-header">
            <h2>Insights</h2>
          </div>
          <div className="insight-list">
            {insights.map((insight) => (
              <article className={`insight-row insight-row--${insight.tone}`} key={insight.id}>
                <div>
                  <strong>{insight.title}</strong>
                  <p>{insight.detail}</p>
                </div>
                {insight.action ? (
                  <Link className="ghost-button compact-button" to={insight.action.to}>
                    {insight.action.label}
                  </Link>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

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
