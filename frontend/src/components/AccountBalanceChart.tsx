import { useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { computeBalanceSeries } from "../utils/accounts";
import { useI18n } from "../state/I18nContext";
import type { Account, Transaction } from "../types";
import { formatCurrency, formatDate } from "../utils/format";

export type BalanceRange = "1m" | "3m" | "1y" | "all";

const RANGE_DAYS: Record<BalanceRange, number> = {
  "1m": 30,
  "3m": 90,
  "1y": 365,
  "all": 0
};

export function AccountBalanceChart({
  account,
  transactions,
  range,
  onRangeChange
}: {
  account: Account;
  transactions: Transaction[];
  range: BalanceRange;
  onRangeChange: (next: BalanceRange) => void;
}) {
  const { t } = useI18n();
  const now = useMemo(() => new Date(), []);
  const data = useMemo(
    () => computeBalanceSeries({
      currentBalance: account.currentBalance,
      transactions,
      rangeDays: RANGE_DAYS[range],
      now
    }),
    [account.currentBalance, transactions, range, now]
  );

  return (
    <div className="balance-chart-card">
      <div className="balance-chart-header">
        <h3>{t("accounts.balanceOverTime")}</h3>
        <div className="range-tabs">
          {(Object.keys(RANGE_DAYS) as BalanceRange[]).map((r) => (
            <button
              key={r}
              type="button"
              className={r === range ? "range-tab is-active" : "range-tab"}
              onClick={() => onRangeChange(r)}
            >
              {labelFor(r, t)}
            </button>
          ))}
        </div>
      </div>
      <div className="balance-chart-body">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity={0.55} />
                <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" hide />
            <YAxis hide domain={["auto", "auto"]} />
            <Tooltip
              formatter={(value) => formatCurrency(Number(value), account.currencyCode)}
              labelFormatter={(label) => formatDate(String(label))}
              cursor={{ stroke: "#64748b", strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey="balance"
              stroke="#34d399"
              strokeWidth={2}
              fill="url(#balanceGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function labelFor(r: BalanceRange, t: ReturnType<typeof useI18n>["t"]): string {
  switch (r) {
    case "1m": return t("accounts.range.month");
    case "3m": return t("accounts.range.threeMonths");
    case "1y": return t("accounts.range.year");
    case "all": return t("accounts.range.all");
  }
}
