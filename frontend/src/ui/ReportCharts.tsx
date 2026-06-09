import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { EmptyState } from "./EmptyState";
import { useI18n } from "../state/I18nContext";
import { formatCurrency } from "../utils/format";

type SpendingPoint = {
  month: string;
  amount: number;
};

type CashflowPoint = {
  month: string;
  income: number;
  expenses: number;
};

type CategoryPoint = {
  categoryId: string;
  categoryName: string;
  amount: number;
  percentage: number;
};

type NetWorthPoint = {
  month: string;
  netWorth: number;
};

type AmountPoint = {
  month: string;
  amount: number;
};

type RatePoint = {
  month: string;
  rate: number;
};

type Translator = ReturnType<typeof useI18n>["t"];

function getCategoryTransactionsPath(categoryId: string) {
  const params = new URLSearchParams({ type: "Expense", categoryId: String(categoryId) });

  return `/transactions?${params.toString()}`;
}

function formatMonthLabel(month: string) {
  const [year, monthNumber] = month.split("-");
  const date = new Date(Date.UTC(Number(year), Number(monthNumber) - 1, 1));

  if (Number.isNaN(date.getTime())) {
    return month;
  }

  return new Intl.DateTimeFormat(undefined, { month: "short" }).format(date);
}

function ChartTooltip({
  active,
  payload,
  label,
  currencyCode
}: {
  active?: boolean;
  payload?: Array<{
    color?: string;
    dataKey?: string | number;
    name?: string;
    value?: number | string;
  }>;
  label?: string;
  currencyCode: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="chart-tooltip">
      {label ? <strong>{formatMonthLabel(label)}</strong> : null}
      {payload.map((entry) => {
        const numericValue = typeof entry.value === "number" ? entry.value : Number(entry.value ?? 0);
        const key = typeof entry.dataKey === "string" ? entry.dataKey : String(entry.dataKey ?? entry.name ?? "value");

        return (
          <div className="chart-tooltip-row" key={key}>
            <span className="chart-tooltip-series">
              <span className="chart-tooltip-dot" style={{ background: entry.color }} />
              {entry.name}
            </span>
            <span>{formatCurrency(numericValue, currencyCode)}</span>
          </div>
        );
      })}
    </div>
  );
}

function RateTooltip({
  active,
  payload,
  label
}: {
  active?: boolean;
  payload?: Array<{
    color?: string;
    dataKey?: string | number;
    name?: string;
    value?: number | string;
  }>;
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="chart-tooltip">
      {label ? <strong>{formatMonthLabel(label)}</strong> : null}
      {payload.map((entry) => {
        const numericValue = typeof entry.value === "number" ? entry.value : Number(entry.value ?? 0);
        const key = typeof entry.dataKey === "string" ? entry.dataKey : String(entry.dataKey ?? entry.name ?? "value");

        return (
          <div className="chart-tooltip-row" key={key}>
            <span className="chart-tooltip-series">
              <span className="chart-tooltip-dot" style={{ background: entry.color }} />
              {entry.name}
            </span>
            <span>{numericValue.toFixed(1)}%</span>
          </div>
        );
      })}
    </div>
  );
}

function ChartShell({ children, ariaLabel }: { children: ReactNode; ariaLabel: string }) {
  return (
    <div className="report-chart">
      <div className="report-chart-surface" aria-label={ariaLabel} role="img">
        {children}
      </div>
    </div>
  );
}

function AmountTrendChart({
  rows,
  currencyCode,
  t,
  label,
  ariaLabel,
  color,
  gradientId,
  emptyBody
}: {
  rows: AmountPoint[];
  currencyCode: string;
  t: Translator;
  label: string;
  ariaLabel: string;
  color: string;
  gradientId: string;
  emptyBody: string;
}) {
  if (rows.length === 0) {
    return <EmptyState title={t("reports.noReportDataYet")} body={emptyBody} />;
  }

  return (
    <ChartShell ariaLabel={ariaLabel}>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={rows} accessibilityLayer margin={{ top: 12, right: 12, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.24} />
              <stop offset="100%" stopColor={color} stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid className="report-grid" strokeDasharray="3 3" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="month"
            minTickGap={24}
            tickFormatter={formatMonthLabel}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            tickFormatter={(value: number) => formatCurrency(value, currencyCode)}
            tickLine={false}
            width={84}
          />
          <Tooltip content={<ChartTooltip currencyCode={currencyCode} />} />
          <Area
            dataKey="amount"
            fill={`url(#${gradientId})`}
            fillOpacity={1}
            stroke="none"
            type="monotone"
          />
          <Line
            activeDot={{ r: 5, strokeWidth: 0, fill: color }}
            dataKey="amount"
            dot={false}
            name={label}
            stroke={color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={3}
            type="monotone"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function SpendingTrendChart({
  rows,
  currencyCode,
  t
}: {
  rows: SpendingPoint[];
  currencyCode: string;
  t: Translator;
}) {
  if (rows.length === 0) {
    return <EmptyState title={t("reports.noReportDataYet")} body={t("reports.noTrendData")} />;
  }

  return (
    <ChartShell ariaLabel={t("reports.monthlyTrendChart")}>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={rows} accessibilityLayer margin={{ top: 12, right: 12, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="spendingTrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid className="report-grid" strokeDasharray="3 3" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="month"
            minTickGap={24}
            tickFormatter={formatMonthLabel}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            tickFormatter={(value: number) => formatCurrency(value, currencyCode)}
            tickLine={false}
            width={84}
          />
          <Tooltip content={<ChartTooltip currencyCode={currencyCode} />} />
          <Area
            dataKey="amount"
            fill="url(#spendingTrendFill)"
            fillOpacity={1}
            stroke="none"
            type="monotone"
          />
          <Line
            activeDot={{ r: 5, strokeWidth: 0, fill: "var(--accent)" }}
            dataKey="amount"
            dot={false}
            name={t("reports.expenses")}
            stroke="var(--accent)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={3}
            type="monotone"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function SavingsRateTrendChart({
  rows,
  t
}: {
  rows: RatePoint[];
  t: Translator;
}) {
  if (rows.length === 0) {
    return <EmptyState title={t("reports.noReportDataYet")} body={t("reports.noTrendData")} />;
  }

  return (
    <ChartShell ariaLabel={t("reports.savingsRateAria")}>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={rows} accessibilityLayer margin={{ top: 12, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid className="report-grid" strokeDasharray="3 3" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="month"
            minTickGap={24}
            tickFormatter={formatMonthLabel}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            tickFormatter={(value: number) => `${value}%`}
            tickLine={false}
            width={64}
          />
          <Tooltip content={<RateTooltip />} />
          <Line
            activeDot={{ r: 5, strokeWidth: 0, fill: "var(--accent-gradient-end)" }}
            dataKey="rate"
            dot={{ r: 2.5, strokeWidth: 0, fill: "var(--accent-gradient-end)" }}
            name={t("reports.savingsRate")}
            stroke="var(--accent-gradient-end)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={3}
            type="monotone"
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function NetCashFlowTrendChart({
  rows,
  currencyCode,
  t
}: {
  rows: AmountPoint[];
  currencyCode: string;
  t: Translator;
}) {
  return (
    <AmountTrendChart
      ariaLabel={t("reports.netCashFlowTrendAria")}
      color="var(--accent-strong)"
      currencyCode={currencyCode}
      emptyBody={t("reports.noCashflowData")}
      gradientId="netCashFlowTrendFill"
      label={t("reports.netCashFlow")}
      rows={rows}
      t={t}
    />
  );
}

export function IncomeTrendChart({
  rows,
  currencyCode,
  t
}: {
  rows: AmountPoint[];
  currencyCode: string;
  t: Translator;
}) {
  return (
    <AmountTrendChart
      ariaLabel={t("reports.incomeTrendAria")}
      color="var(--positive)"
      currencyCode={currencyCode}
      emptyBody={t("reports.noCashflowData")}
      gradientId="incomeTrendFill"
      label={t("reports.income")}
      rows={rows}
      t={t}
    />
  );
}

export function CashflowChart({
  rows,
  currencyCode,
  t
}: {
  rows: CashflowPoint[];
  currencyCode: string;
  t: Translator;
}) {
  if (rows.length === 0) {
    return <EmptyState title={t("reports.noReportDataYet")} body={t("reports.noCashflowData")} />;
  }

  return (
    <ChartShell ariaLabel={t("reports.incomeVsExpense")}>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={rows} accessibilityLayer barCategoryGap={18} margin={{ top: 12, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid className="report-grid" strokeDasharray="3 3" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="month"
            minTickGap={24}
            tickFormatter={formatMonthLabel}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            tickFormatter={(value: number) => formatCurrency(value, currencyCode)}
            tickLine={false}
            width={84}
          />
          <Tooltip content={<ChartTooltip currencyCode={currencyCode} />} />
          <Bar dataKey="income" fill="var(--positive)" name={t("reports.income")} radius={[8, 8, 0, 0]} />
          <Bar dataKey="expenses" fill="var(--negative)" name={t("reports.expenses")} radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function CategoryBreakdownChart({
  rows,
  currencyCode,
  t
}: {
  rows: CategoryPoint[];
  currencyCode: string;
  t: Translator;
}) {
  if (rows.length === 0) {
    return <EmptyState title={t("reports.noReportDataYet")} body={t("reports.noCategoryData")} />;
  }

  return (
    <ChartShell ariaLabel={t("reports.categoryBreakdown")}>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={[...rows].reverse()} accessibilityLayer layout="vertical" margin={{ top: 12, right: 12, left: 24, bottom: 0 }}>
          <CartesianGrid className="report-grid" strokeDasharray="3 3" horizontal={false} />
          <XAxis axisLine={false} tickFormatter={(value: number) => formatCurrency(value, currencyCode)} tickLine={false} type="number" />
          <YAxis
            axisLine={false}
            dataKey="categoryName"
            tickLine={false}
            type="category"
            width={92}
          />
          <Tooltip content={<ChartTooltip currencyCode={currencyCode} />} />
          <Bar dataKey="amount" name={t("reports.expenses")} radius={[0, 8, 8, 0]}>
            {rows.map((row, index) => (
              <Cell
                fill={index % 2 === 0 ? "var(--accent)" : "var(--accent-gradient-end)"}
                key={row.categoryId}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="chart-summary-list">
        {rows.map((row) => (
          <div className="chart-summary-item" key={row.categoryId}>
            <Link to={getCategoryTransactionsPath(row.categoryId)}><strong>{row.categoryName}</strong></Link>
            <span>{formatCurrency(row.amount, currencyCode)} · {row.percentage}%</span>
          </div>
        ))}
      </div>
    </ChartShell>
  );
}

export function NetWorthHistoryChart({
  rows,
  currencyCode,
  t
}: {
  rows: NetWorthPoint[];
  currencyCode: string;
  t: Translator;
}) {
  if (rows.length === 0) {
    return <EmptyState title={t("reports.noReportDataYet")} body={t("reports.noTrendData")} />;
  }

  return (
    <ChartShell ariaLabel={t("reports.netWorthHistory")}>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={rows} accessibilityLayer margin={{ top: 12, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid className="report-grid" strokeDasharray="3 3" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="month"
            minTickGap={24}
            tickFormatter={formatMonthLabel}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            tickFormatter={(value: number) => formatCurrency(value, currencyCode)}
            tickLine={false}
            width={84}
          />
          <Tooltip content={<ChartTooltip currencyCode={currencyCode} />} />
          <Line
            activeDot={{ r: 5, strokeWidth: 0, fill: "var(--accent-strong)" }}
            dataKey="netWorth"
            dot={{ r: 2.5, strokeWidth: 0, fill: "var(--accent-strong)" }}
            name={t("reports.netWorth")}
            stroke="var(--accent-strong)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={3}
            type="monotone"
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}
