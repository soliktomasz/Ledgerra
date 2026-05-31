import { useMemo } from "react";
import { useReportingOverview } from "../hooks/useReportingOverview";
import { useI18n } from "../state/I18nContext";
import { MetricCard } from "../ui/MetricCard";
import { PageHeader } from "../ui/PageHeader";
import { CashflowChart, CategoryBreakdownChart, NetWorthHistoryChart, SpendingTrendChart } from "../ui/ReportCharts";
import { SectionCard } from "../ui/SectionCard";
import { CashFlowIcon, CategoryIcon, ExpenseIcon, IncomeIcon, NetWorthIcon, TrendIcon } from "../ui/icons";
import { formatCurrency } from "../utils/format";
import type { ReportingRangePreset } from "../types";

const rangePresets: ReportingRangePreset[] = ["3M", "6M", "12M", "YTD"];

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
  const spendingPoints = useMemo(() => overview?.monthlySpendingTrend ?? [], [overview?.monthlySpendingTrend]);
  const netWorthPoints = useMemo(
    () => overview?.netWorthHistory.map((point) => ({ month: point.month, netWorth: point.netWorth })) ?? [],
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
        <p className="warning-banner" key={`${warning.code}-${warning.message}`}>{warning.message}</p>
      ))}

      <div className="metric-grid">
        <MetricCard label={t("reports.income")} value={formatCurrency(overview?.summary.incomeTotal ?? 0, currencyCode)} tone="positive" detail={overview ? `${overview.startMonth} to ${overview.endMonth}` : t("reports.selectedRange")} icon={<IncomeIcon />} />
        <MetricCard label={t("reports.expenses")} value={formatCurrency(overview?.summary.expenseTotal ?? 0, currencyCode)} tone="negative" detail={loading ? t("reports.loadingReports") : t("dashboard.transfersExcluded")} icon={<ExpenseIcon />} />
        <MetricCard label={t("reports.netCashFlow")} value={formatCurrency(overview?.summary.netCashFlow ?? 0, currencyCode)} tone={(overview?.summary.netCashFlow ?? 0) >= 0 ? "positive" : "negative"} detail={t("dashboard.incomeMinusExpenses")} icon={<CashFlowIcon />} />
        <MetricCard label={t("reports.netWorth")} value={formatCurrency(netWorthValue, currencyCode)} detail={t("reports.latestAvailableMonth")} icon={<NetWorthIcon />} />
      </div>

      <div className="reports-grid">
        <SectionCard title={t("reports.spendingTrend")} icon={<TrendIcon />}>
          <SpendingTrendChart rows={spendingPoints} currencyCode={currencyCode} t={t} />
        </SectionCard>

        <SectionCard title={t("reports.incomeVsExpense")} icon={<CashFlowIcon />}>
          <CashflowChart rows={overview?.incomeVsExpense ?? []} currencyCode={currencyCode} t={t} />
        </SectionCard>

        <SectionCard title={t("reports.categoryBreakdown")} icon={<CategoryIcon />}>
          <CategoryBreakdownChart rows={overview?.categoryBreakdown ?? []} currencyCode={currencyCode} t={t} />
        </SectionCard>

        <SectionCard title={t("reports.netWorthHistory")} icon={<NetWorthIcon />}>
          <NetWorthHistoryChart rows={netWorthPoints} currencyCode={currencyCode} t={t} />
        </SectionCard>
      </div>
    </div>
  );
}
