import { useMemo, useState } from "react";
import type { Account, Category, Transaction } from "../types";
import { computeMonthInflows, computeMonthOutflows, computeWeekChange } from "../utils/accounts";
import { formatCurrency, formatDate } from "../utils/format";
import { useI18n } from "../state/I18nContext";
import { AccountBalanceChart, type BalanceRange } from "./AccountBalanceChart";

type Translator = ReturnType<typeof useI18n>["t"];

const ICON_CLASS: Record<string, string> = {
  Bank: "is-bank",
  Piggy: "is-piggy",
  Card: "is-card",
  Cash: "is-cash",
  Chart: "is-chart",
  Users: "is-users"
};

export function AccountDetailColumn({
  account,
  transactions,
  categories,
  selectedMonth,
  onEdit,
  onTransfer
}: {
  account: Account;
  transactions: Transaction[];
  categories: Category[];
  selectedMonth: string;
  onEdit: () => void;
  onTransfer: () => void;
}) {
  const { t } = useI18n();
  const [range, setRange] = useState<BalanceRange>("3m");

  const weekChange = useMemo(() => computeWeekChange(transactions, new Date()), [transactions]);
  const monthIncome = useMemo(() => computeMonthInflows(transactions, selectedMonth), [transactions, selectedMonth]);
  const monthExpenses = useMemo(() => computeMonthOutflows(transactions, selectedMonth), [transactions, selectedMonth]);
  const recentOps = useMemo(
    () => [...transactions].sort((a, b) => b.occurredOnUtc.localeCompare(a.occurredOnUtc)).slice(0, 5),
    [transactions]
  );
  const monthLabel = formatMonthLabel(selectedMonth);

  return (
    <section className="account-detail-column">
      <header className="account-detail-header">
        <div className={"account-icon account-icon-lg " + (ICON_CLASS[account.iconKind] ?? "is-bank")} aria-hidden="true" />
        <div className="account-detail-title">
          <p className="account-detail-breadcrumb">
            {breadcrumbForType(account.type, t)}{account.institutionName ? ` · ${account.institutionName}` : ""}
          </p>
          <h2>{account.name}</h2>
          <p className="account-detail-sub">
            {account.accountNumberMasked ? account.accountNumberMasked + " · " : ""}
            {t("accounts.currencyLabel", { code: account.currencyCode })}
          </p>
        </div>
        <div className="account-detail-actions">
          <button type="button" className="ghost-button" onClick={onEdit}>{t("accounts.edit")}</button>
          <button type="button" className="primary-button" onClick={onTransfer}>{t("accounts.transfer")}</button>
        </div>
      </header>

      <div className="kpi-grid">
        <KpiCard
          label={t("accounts.kpi.balance")}
          value={formatCurrency(account.currentBalance, account.currencyCode)}
          helper={t("accounts.kpi.afterLastTransaction")}
        />
        <KpiCard
          label={t("accounts.kpi.weekChange")}
          value={formatSigned(weekChange, account.currencyCode)}
          helper={t("accounts.kpi.sevenDays")}
          tone={weekChange > 0 ? "positive" : weekChange < 0 ? "negative" : undefined}
        />
        <KpiCard
          label={t("accounts.kpi.monthIncome", { month: monthLabel })}
          value={"+ " + formatCurrency(monthIncome, account.currencyCode)}
          helper={t("accounts.kpi.transactionsCount", { count: String(countInMonth(transactions, selectedMonth, ["Income", "TransferIn"])) })}
          tone="positive"
        />
        <KpiCard
          label={t("accounts.kpi.monthExpenses", { month: monthLabel })}
          value={"− " + formatCurrency(monthExpenses, account.currencyCode)}
          helper={t("accounts.kpi.transactionsCount", { count: String(countInMonth(transactions, selectedMonth, ["Expense", "TransferOut"])) })}
          tone="negative"
        />
      </div>

      <AccountBalanceChart
        account={account}
        transactions={transactions}
        range={range}
        onRangeChange={setRange}
      />

      <section className="recent-ops-card">
        <header className="recent-ops-header">
          <h3>{t("accounts.recentOps")}</h3>
          <a className="recent-ops-link" href={`/transactions?accountId=${account.id}`}>{t("accounts.seeAll")}</a>
        </header>
        <ul className="recent-ops-list">
          {recentOps.map((tx) => {
            const cat = categories.find((c) => c.id === tx.categoryId);
            const label = tx.note?.trim() || cat?.name || tx.type;
            const signed = signedDelta(tx);
            return (
              <li key={tx.id} className="recent-op-row">
                <span className="recent-op-icon" style={{ backgroundColor: cat?.color ?? "#475569" }} aria-hidden="true" />
                <div className="recent-op-body">
                  <span className="recent-op-label">{label}</span>
                  <span className="recent-op-sub">
                    {cat?.name ? cat.name + " · " : ""}
                    {tx.type} · {formatDate(tx.occurredOnUtc)}
                  </span>
                </div>
                <span className={"recent-op-amount " + (signed >= 0 ? "is-positive" : "is-negative")}>
                  {formatSigned(signed, account.currencyCode)}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </section>
  );
}

function KpiCard({ label, value, helper, tone }: {
  label: string;
  value: string;
  helper: string;
  tone?: "positive" | "negative";
}) {
  return (
    <div className={"kpi-card " + (tone ?? "")}>
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value">{value}</strong>
      <span className="kpi-helper">{helper}</span>
    </div>
  );
}

function formatSigned(value: number, currencyCode: string): string {
  if (value > 0) return "+ " + formatCurrency(value, currencyCode);
  if (value < 0) return "− " + formatCurrency(Math.abs(value), currencyCode);
  return formatCurrency(0, currencyCode);
}

function signedDelta(tx: Transaction): number {
  if (tx.type === "Expense" || tx.type === "TransferOut") return -Math.abs(tx.amount);
  if (tx.type === "Income" || tx.type === "TransferIn") return Math.abs(tx.amount);
  return tx.amount;
}

function countInMonth(transactions: Transaction[], month: string, types: string[]): number {
  return transactions.filter((t) => t.occurredOnUtc.slice(0, 7) === month && types.includes(t.type)).length;
}

function formatMonthLabel(monthYYYYMM: string): string {
  const [, m] = monthYYYYMM.split("-");
  const months = [
    "styczniu", "lutym", "marcu", "kwietniu", "maju", "czerwcu",
    "lipcu", "sierpniu", "wrześniu", "październiku", "listopadzie", "grudniu"
  ];
  return months[Number(m) - 1] ?? monthYYYYMM;
}

function breadcrumbForType(type: string, t: Translator): string {
  switch (type) {
    case "Checking": return t("accounts.group.checking");
    case "Savings": return t("accounts.group.savings");
    case "Credit": return t("accounts.group.credit");
    case "Cash": return t("accounts.group.cash");
    case "Investment": return t("accounts.group.investment");
    case "Joint": return t("accounts.group.joint");
    default: return type;
  }
}
