import { useMemo, useState } from "react";
import { useReportingOverview } from "../hooks/useReportingOverview";
import { useI18n } from "../state/I18nContext";
import { MetricCard } from "../ui/MetricCard";
import { PageHeader } from "../ui/PageHeader";
import {
  CashflowChart,
  CategoryBreakdownChart,
  IncomeTrendChart,
  NetCashFlowTrendChart,
  NetWorthHistoryChart,
  SavingsRateTrendChart,
  SpendingTrendChart
} from "../ui/ReportCharts";
import { SectionCard } from "../ui/SectionCard";
import { CashFlowIcon, CategoryIcon, ExpenseIcon, IncomeIcon, NetWorthIcon, TrashIcon, TrendIcon } from "../ui/icons";
import { formatCurrency } from "../utils/format";
import type { ReportingRangePreset } from "../types";

const rangePresets: ReportingRangePreset[] = ["3M", "6M", "12M", "YTD"];

type ReportChartId =
  | "spendingTrend"
  | "incomeVsExpense"
  | "categoryBreakdown"
  | "netWorthHistory"
  | "savingsRateTrend"
  | "netCashFlowTrend"
  | "incomeTrend";

const reportChartStorageKey = "ledgerra:reports:enabled-charts";
const defaultReportChartIds: ReportChartId[] = ["spendingTrend", "incomeVsExpense", "categoryBreakdown", "netWorthHistory"];
const allReportChartIds: ReportChartId[] = [
  "spendingTrend",
  "incomeVsExpense",
  "categoryBreakdown",
  "netWorthHistory",
  "savingsRateTrend",
  "netCashFlowTrend",
  "incomeTrend"
];

function isReportChartId(value: unknown): value is ReportChartId {
  return typeof value === "string" && allReportChartIds.includes(value as ReportChartId);
}

function readEnabledChartIds() {
  if (typeof window === "undefined") {
    return defaultReportChartIds;
  }

  const storedValue = window.localStorage.getItem(reportChartStorageKey);
  if (storedValue === null) {
    return defaultReportChartIds;
  }

  try {
    const parsedValue = JSON.parse(storedValue);
    if (!Array.isArray(parsedValue)) {
      return defaultReportChartIds;
    }

    return parsedValue.filter(isReportChartId);
  } catch {
    return defaultReportChartIds;
  }
}

function storeEnabledChartIds(chartIds: ReportChartId[]) {
  window.localStorage.setItem(reportChartStorageKey, JSON.stringify(chartIds));
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
  const spendingPoints = useMemo(() => overview?.monthlySpendingTrend ?? [], [overview?.monthlySpendingTrend]);
  const cashflowPoints = useMemo(() => overview?.incomeVsExpense ?? [], [overview?.incomeVsExpense]);
  const netWorthPoints = useMemo(
    () => overview?.netWorthHistory.map((point) => ({ month: point.month, netWorth: point.netWorth })) ?? [],
    [overview?.netWorthHistory]
  );
  const savingsRatePoints = useMemo(
    () => cashflowPoints.map((point) => ({
      month: point.month,
      rate: point.income === 0 ? 0 : ((point.income - point.expenses) / point.income) * 100
    })),
    [cashflowPoints]
  );
  const netCashFlowPoints = useMemo(
    () => cashflowPoints.map((point) => ({ month: point.month, amount: point.net })),
    [cashflowPoints]
  );
  const incomeTrendPoints = useMemo(
    () => cashflowPoints.map((point) => ({ month: point.month, amount: point.income })),
    [cashflowPoints]
  );
  const [enabledChartIds, setEnabledChartIds] = useState<ReportChartId[]>(readEnabledChartIds);
  const [isChartPickerOpen, setChartPickerOpen] = useState(false);

  const setStoredEnabledChartIds = (chartIds: ReportChartId[]) => {
    setEnabledChartIds(chartIds);
    storeEnabledChartIds(chartIds);
  };

  const toggleChart = (chartId: ReportChartId) => {
    setStoredEnabledChartIds(
      enabledChartIds.includes(chartId)
        ? enabledChartIds.filter((enabledChartId) => enabledChartId !== chartId)
        : [...enabledChartIds, chartId]
    );
  };

  const removeChart = (chartId: ReportChartId) => {
    setStoredEnabledChartIds(enabledChartIds.filter((enabledChartId) => enabledChartId !== chartId));
  };

  const chartDefinitions: Record<ReportChartId, {
    title: string;
    icon: JSX.Element;
    content: JSX.Element;
  }> = {
    spendingTrend: {
      title: t("reports.spendingTrend"),
      icon: <TrendIcon />,
      content: <SpendingTrendChart rows={spendingPoints} currencyCode={currencyCode} t={t} />
    },
    incomeVsExpense: {
      title: t("reports.incomeVsExpense"),
      icon: <CashFlowIcon />,
      content: <CashflowChart rows={cashflowPoints} currencyCode={currencyCode} t={t} />
    },
    categoryBreakdown: {
      title: t("reports.categoryBreakdown"),
      icon: <CategoryIcon />,
      content: <CategoryBreakdownChart rows={overview?.categoryBreakdown ?? []} currencyCode={currencyCode} t={t} />
    },
    netWorthHistory: {
      title: t("reports.netWorthHistory"),
      icon: <NetWorthIcon />,
      content: <NetWorthHistoryChart rows={netWorthPoints} currencyCode={currencyCode} t={t} />
    },
    savingsRateTrend: {
      title: t("reports.savingsRate"),
      icon: <TrendIcon />,
      content: <SavingsRateTrendChart rows={savingsRatePoints} t={t} />
    },
    netCashFlowTrend: {
      title: t("reports.netCashFlowTrend"),
      icon: <CashFlowIcon />,
      content: <NetCashFlowTrendChart rows={netCashFlowPoints} currencyCode={currencyCode} t={t} />
    },
    incomeTrend: {
      title: t("reports.incomeTrend"),
      icon: <IncomeIcon />,
      content: <IncomeTrendChart rows={incomeTrendPoints} currencyCode={currencyCode} t={t} />
    }
  };
  const enabledCharts = enabledChartIds.map((chartId) => ({ id: chartId, ...chartDefinitions[chartId] }));

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
            <div className="chart-picker">
              <button
                aria-expanded={isChartPickerOpen}
                className="ghost-button compact-button"
                onClick={() => setChartPickerOpen((isOpen) => !isOpen)}
                type="button"
              >
                {t("reports.charts")}
              </button>
              {isChartPickerOpen ? (
                <div className="chart-picker-menu">
                  {allReportChartIds.map((chartId) => (
                    <label className="chart-picker-row" key={chartId}>
                      <input
                        checked={enabledChartIds.includes(chartId)}
                        onChange={() => toggleChart(chartId)}
                        type="checkbox"
                      />
                      <span>{chartDefinitions[chartId].title}</span>
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
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

      {enabledCharts.length === 0 ? (
        <section className="no-report-charts">
          <strong>{t("reports.noChartsSelected")}</strong>
          <p>{t("reports.noChartsSelectedBody")}</p>
          <button className="ghost-button compact-button" type="button" onClick={() => setChartPickerOpen(true)}>
            {t("reports.addCharts")}
          </button>
        </section>
      ) : (
        <div className="reports-grid">
          {enabledCharts.map((chart) => (
            <SectionCard
              actions={(
                <button
                  aria-label={t("reports.removeChart", { chart: chart.title })}
                  className="ghost-button compact-button chart-card-action"
                  onClick={() => removeChart(chart.id)}
                  type="button"
                >
                  <TrashIcon />
                </button>
              )}
              icon={chart.icon}
              key={chart.id}
              title={chart.title}
            >
              {chart.content}
            </SectionCard>
          ))}
        </div>
      )}
    </div>
  );
}
