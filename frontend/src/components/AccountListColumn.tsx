import { useMemo } from "react";
import { accountIconClass, computeNetWorth, filterAccounts, groupAccountsByType, type AccountGroupType } from "../utils/accounts";
import { formatCurrency } from "../utils/format";
import { useI18n } from "../state/I18nContext";
import type { Account } from "../types";

function groupLabel(t: ReturnType<typeof useI18n>["t"], type: AccountGroupType): string {
  switch (type) {
    case "Checking":
      return t("accounts.group.checking");
    case "Savings":
      return t("accounts.group.savings");
    case "Credit":
      return t("accounts.group.credit");
    case "Cash":
      return t("accounts.group.cash");
    case "Investment":
      return t("accounts.group.investment");
    case "Mortgage":
      return t("accounts.group.mortgage");
    case "Joint":
      return t("accounts.group.joint");
  }
}

export function AccountListColumn({
  accounts,
  selectedAccountId,
  searchQuery,
  onSearchQueryChange,
  onSelectAccount,
  onAddAccount
}: {
  accounts: Account[];
  selectedAccountId: string | null;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  onSelectAccount: (id: string) => void;
  onAddAccount: () => void;
}) {
  const { t } = useI18n();
  const groups = useMemo(() => groupAccountsByType(accounts), [accounts]);
  const visibleGroups = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return groups.map((g) => ({ ...g, visibleAccounts: g.accounts }));
    return groups
      .map((g) => ({ ...g, visibleAccounts: filterAccounts(g.accounts, q) }))
      .filter((g) => g.visibleAccounts.length > 0);
  }, [groups, searchQuery]);
  const netWorth = useMemo(() => computeNetWorth(accounts), [accounts]);

  return (
    <aside className="account-list-column">
      <div className="net-worth-card">
        <div>
          <span className="net-worth-label">{t("accounts.netWorth")}</span>
          <strong className="net-worth-value">
            {netWorth.currencyCode ? formatCurrency(netWorth.value, netWorth.currencyCode) : "—"}
          </strong>
        </div>
        <button type="button" className="primary-button net-worth-add" onClick={onAddAccount}>
          {"+ " + t("accounts.add")}
        </button>
      </div>

      <div className="account-search-input">
        <input
          type="search"
          placeholder={t("accounts.searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
        />
      </div>

      <div className="account-groups">
        {visibleGroups.map((group) => (
          <section key={group.type} className="account-group">
            <header className="account-group-header">
              <span className="account-group-label">{groupLabel(t, group.type)}</span>
              <span className="account-group-total">
                {group.currencyCode ? formatCurrency(group.totalBalance, group.currencyCode) : "—"}
              </span>
            </header>
            <ul className="account-group-body">
              {group.visibleAccounts.map((account) => (
                <li key={account.id}>
                  <button
                    type="button"
                    className={"account-row " + (account.id === selectedAccountId ? "is-active" : "")}
                    onClick={() => onSelectAccount(account.id)}
                  >
                    <span className={"account-icon " + accountIconClass(account.iconKind)} aria-hidden="true" />
                    <span className="account-row-body">
                      <span className="account-row-name">{account.name}</span>
                      <span className="account-row-sub">
                        {account.institutionName ? `${account.institutionName} · ` : ""}
                        {account.accountNumberMasked ?? ""}
                      </span>
                    </span>
                    <span className="account-row-balance">
                      {formatCurrency(account.currentBalance, account.currencyCode)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </aside>
  );
}
