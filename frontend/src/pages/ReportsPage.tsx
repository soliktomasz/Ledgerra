import { useMemo } from "react";
import { useReportingOverview } from "../hooks/useReportingOverview";
import { useI18n } from "../state/I18nContext";
import { EmptyState } from "../ui/EmptyState";
import { MetricCard } from "../ui/MetricCard";
import { PageHeader } from "../ui/PageHeader";
import { SectionCard } from "../ui/SectionCard";
import { CashFlowIcon, CategoryIcon, ExpenseIcon, IncomeIcon, NetWorthIcon, TrendIcon } from "../ui/icons";
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

function LineChart({ points, t }: { points: ChartPoint[]; t: ReturnType<typeof useI18n>["t"] }) {
  if (points.length === 0) {
    return <EmptyState title={t("reports.noReportDataYet")} body={t("reports.noTrendData")} />;
  }

  const path = buildPath(points, 320, 140);

  return (
    <div className="report-chart">
      <svg viewBox="0 0 320 160" role="img" aria-label={t("reports.monthlyTrendChart")}>
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

function GroupedBars({ rows, currencyCode, t }: { rows: Array<{ month: string; income: number; expenses: number }>; currencyCode: string; t: ReturnType<typeof useI18n>["t"] }) {
  if (rows.length === 0) {
    return <EmptyState title={t("reports.noReportDataYet")} body={t("reports.noCashflowData")} />;
  }

  const max = Math.max(...rows.flatMap((row) => [row.income, row.expenses]), 1);

  return (
    <div className="cashflow-bars">
      {rows.map((row) => (
        <div className="cashflow-month" key={row.month}>
          <div
            className="cashflow-pair"
            aria-label={t("reports.cashflowAria", {
              month: row.month,
              income: formatCurrency(row.income, currencyCode),
              expenses: formatCurrency(row.expenses, currencyCode)
            })}
          >
            <span className="cashflow-bar cashflow-bar--income" style={{ height: `${Math.max((row.income / max) * 100, 4)}%` }} />
            <span className="cashflow-bar cashflow-bar--expense" style={{ height: `${Math.max((row.expenses / max) * 100, 4)}%` }} />
          </div>
          <small>{row.month.slice(5)}</small>
        </div>
      ))}
    </div>
  );
}

function CategoryBars({ rows, currencyCode, t }: { rows: Array<{ categoryId: string; categoryName: string; amount: number; percentage: number }>; currencyCode: string; t: ReturnType<typeof useI18n>["t"] }) {
  if (rows.length === 0) {
    return <EmptyState title={t("reports.noReportDataYet")} body={t("reports.noCategoryData")} />;
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
  const { t } = useI18n();
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
        eyebrow={t("reports.eyebrow")}
        title={t("reports.title")}
        description={t("reports.description")}
        actions={(
          <div className="report-controls">
            <div className="segmented-control" aria-label={t("reports.range")}>
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
              <span>{t("reports.account")}</span>
              <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
                <option value="">{t("common.allAccounts")}</option>
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
        <MetricCard label={t("reports.income")} value={formatCurrency(overview?.summary.incomeTotal ?? 0, currencyCode)} tone="positive" detail={overview ? `${overview.startMonth} to ${overview.endMonth}` : t("reports.selectedRange")} icon={<IncomeIcon />} />
        <MetricCard label={t("reports.expenses")} value={formatCurrency(overview?.summary.expenseTotal ?? 0, currencyCode)} tone="negative" detail={loading ? t("reports.loadingReports") : t("dashboard.transfersExcluded")} icon={<ExpenseIcon />} />
        <MetricCard label={t("reports.netCashFlow")} value={formatCurrency(overview?.summary.netCashFlow ?? 0, currencyCode)} tone={(overview?.summary.netCashFlow ?? 0) >= 0 ? "positive" : "negative"} detail={t("dashboard.incomeMinusExpenses")} icon={<CashFlowIcon />} />
        <MetricCard label={t("reports.netWorth")} value={formatCurrency(netWorthValue, currencyCode)} detail={t("reports.latestAvailableMonth")} icon={<NetWorthIcon />} />
      </div>

      <div className="reports-grid">
        <SectionCard title={t("reports.spendingTrend")} icon={<TrendIcon />}>
          <LineChart points={spendingPoints} t={t} />
        </SectionCard>

        <SectionCard title={t("reports.incomeVsExpense")} icon={<CashFlowIcon />}>
          <GroupedBars rows={overview?.incomeVsExpense ?? []} currencyCode={currencyCode} t={t} />
        </SectionCard>

        <SectionCard title={t("reports.categoryBreakdown")} icon={<CategoryIcon />}>
          <CategoryBars rows={overview?.categoryBreakdown ?? []} currencyCode={currencyCode} t={t} />
        </SectionCard>

        <SectionCard title={t("reports.netWorthHistory")} icon={<NetWorthIcon />}>
          <LineChart points={netWorthPoints} t={t} />
        </SectionCard>
      </div>
    </div>
  );
}
