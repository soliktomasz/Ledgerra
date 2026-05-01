import { useMemo } from "react";
import { useReportingOverview } from "../hooks/useReportingOverview";
import { EmptyState } from "../ui/EmptyState";
import { MetricCard } from "../ui/MetricCard";
import { PageHeader } from "../ui/PageHeader";
import { SectionCard } from "../ui/SectionCard";
import { formatCurrency } from "../utils/format";
import type { ReportingRangePreset } from "../types";

const rangePresets: ReportingRangePreset[] = ["3M", "6M", "12M", "YTD"];

type ChartPoint = {
  label: string;
  value: number;
};

function buildPath(points: ChartPoint[], width: number, height: number) {
  if (points.length === 0) {
    return "";
  }

  const max = Math.max(...points.map((point) => point.value), 1);
  const step = points.length === 1 ? width : width / (points.length - 1);

  return points
    .map((point, index) => {
      const x = index * step;
      const y = height - (point.value / max) * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function LineChart({ points }: { points: ChartPoint[] }) {
  if (points.length === 0) {
    return <EmptyState title="No report data yet" body="Add transactions across months to populate this view." />;
  }

  const path = buildPath(points, 320, 140);

  return (
    <div className="report-chart">
      <svg viewBox="0 0 320 160" role="img" aria-label="Monthly trend chart">
        <path className="report-line-area" d={`${path} L 320 150 L 0 150 Z`} />
        <path className="report-line" d={path} />
      </svg>
      <div className="chart-axis">
        <span>{points[0].label}</span>
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  );
}

function GroupedBars({ rows, currencyCode }: { rows: Array<{ month: string; income: number; expenses: number }>; currencyCode: string }) {
  if (rows.length === 0) {
    return <EmptyState title="No report data yet" body="Income and expense bars appear after activity is added." />;
  }

  const max = Math.max(...rows.flatMap((row) => [row.income, row.expenses]), 1);

  return (
    <div className="cashflow-bars">
      {rows.map((row) => (
        <div className="cashflow-month" key={row.month}>
          <div className="cashflow-pair" aria-label={`${row.month} income ${formatCurrency(row.income, currencyCode)} expenses ${formatCurrency(row.expenses, currencyCode)}`}>
            <span className="cashflow-bar cashflow-bar--income" style={{ height: `${Math.max((row.income / max) * 100, 4)}%` }} />
            <span className="cashflow-bar cashflow-bar--expense" style={{ height: `${Math.max((row.expenses / max) * 100, 4)}%` }} />
          </div>
          <small>{row.month.slice(5)}</small>
        </div>
      ))}
    </div>
  );
}

function CategoryBars({ rows, currencyCode }: { rows: Array<{ categoryId: string; categoryName: string; amount: number; percentage: number }>; currencyCode: string }) {
  if (rows.length === 0) {
    return <EmptyState title="No report data yet" body="Categorized expenses will appear here." />;
  }

  const max = Math.max(...rows.map((row) => row.amount), 1);

  return (
    <div className="bar-list">
      {rows.map((row) => (
        <div className="bar-item" key={row.categoryId}>
          <div>
            <strong>{row.categoryName}</strong>
            <span>{formatCurrency(row.amount, currencyCode)} · {row.percentage}%</span>
          </div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${Math.max((row.amount / max) * 100, 12)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ReportsPage() {
  const {
    overview,
    accounts,
    rangePreset,
    accountId,
    loading,
    error,
    setRangePreset,
    setAccountId
  } = useReportingOverview();
  const currencyCode = overview?.currencyCode ?? "USD";
  const netWorthHistory = overview?.netWorthHistory ?? [];
  const netWorthValue = netWorthHistory.length > 0 ? netWorthHistory[netWorthHistory.length - 1].netWorth : 0;
  const spendingPoints = useMemo(
    () => overview?.monthlySpendingTrend.map((point) => ({ label: point.month, value: point.amount })) ?? [],
    [overview?.monthlySpendingTrend]
  );
  const netWorthPoints = useMemo(
    () => overview?.netWorthHistory.map((point) => ({ label: point.month, value: point.netWorth })) ?? [],
    [overview?.netWorthHistory]
  );

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Analytics"
        title="Reports"
        description="Track month-by-month spending, cash flow, category weight, and net worth history."
        actions={(
          <div className="report-controls">
            <div className="segmented-control" aria-label="Report range">
              {rangePresets.map((preset) => (
                <button
                  aria-pressed={rangePreset === preset}
                  className="segmented-button"
                  key={preset}
                  onClick={() => setRangePreset(preset)}
                  type="button"
                >
                  {preset}
                </button>
              ))}
            </div>
            <label className="filter-select">
              <span>Account</span>
              <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
                <option value="">All accounts</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.name}</option>
                ))}
              </select>
            </label>
          </div>
        )}
      />

      {error ? <p className="error-banner">{error}</p> : null}

      {overview?.warnings.map((warning) => (
        <p className="warning-banner" key={warning.code}>{warning.message}</p>
      ))}

      <div className="metric-grid">
        <MetricCard label="Income" value={formatCurrency(overview?.summary.incomeTotal ?? 0, currencyCode)} tone="positive" detail={overview ? `${overview.startMonth} to ${overview.endMonth}` : "Selected range"} />
        <MetricCard label="Expenses" value={formatCurrency(overview?.summary.expenseTotal ?? 0, currencyCode)} tone="negative" detail={loading ? "Loading reports." : "Transfers excluded."} />
        <MetricCard label="Net cash flow" value={formatCurrency(overview?.summary.netCashFlow ?? 0, currencyCode)} tone={(overview?.summary.netCashFlow ?? 0) >= 0 ? "positive" : "negative"} detail="Income minus expenses." />
        <MetricCard label="Net worth" value={formatCurrency(netWorthValue, currencyCode)} detail="Latest available month." />
      </div>

      <div className="reports-grid">
        <SectionCard title="Spending trend">
          <LineChart points={spendingPoints} />
        </SectionCard>

        <SectionCard title="Income vs expense">
          <GroupedBars rows={overview?.incomeVsExpense ?? []} currencyCode={currencyCode} />
        </SectionCard>

        <SectionCard title="Category breakdown">
          <CategoryBars rows={overview?.categoryBreakdown ?? []} currencyCode={currencyCode} />
        </SectionCard>

        <SectionCard title="Net worth history">
          <LineChart points={netWorthPoints} />
        </SectionCard>
      </div>
    </div>
  );
}
