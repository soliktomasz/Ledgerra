import { useLedgerraData } from "../hooks/useLedgerraData";
import { PageHeader } from "../ui/PageHeader";
import { MetricCard } from "../ui/MetricCard";
import { SectionCard } from "../ui/SectionCard";
import { EmptyState } from "../ui/EmptyState";
import { formatCurrency } from "../utils/format";

export function DashboardPage() {
  const { dashboard, budget, loading, error } = useLedgerraData();

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Overview"
        title="Money at a glance"
        description="See the month’s inflow, spending rhythm, and remaining budget without noise."
      />

      {error ? <p className="error-banner">{error}</p> : null}

      <div className="metric-grid">
        <MetricCard
          label="Income"
          value={formatCurrency(dashboard?.income ?? 0)}
          tone="positive"
          detail="All monthly inflows."
        />
        <MetricCard
          label="Expenses"
          value={formatCurrency(dashboard?.expenses ?? 0)}
          tone="negative"
          detail="Transfers excluded."
        />
        <MetricCard
          label="Net"
          value={formatCurrency(dashboard?.net ?? 0)}
          tone={(dashboard?.net ?? 0) >= 0 ? "positive" : "negative"}
          detail="Income minus expenses."
        />
        <MetricCard
          label="Budget Remaining"
          value={formatCurrency(budget?.totalRemaining ?? dashboard?.budgetRemaining ?? 0)}
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
                      <span>{formatCurrency(category.amount)}</span>
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
                  <strong>{formatCurrency(account.balance)}</strong>
                </article>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
