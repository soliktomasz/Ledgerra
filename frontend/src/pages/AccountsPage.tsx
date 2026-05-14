import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useI18n } from "../state/I18nContext";
import { useMonthSelection } from "../state/MonthContext";
import { useLedgerraData } from "../hooks/useLedgerraData";
import type { Account } from "../types";
import { AccountListColumn } from "../components/AccountListColumn";
import { AccountDetailColumn } from "../components/AccountDetailColumn";
import { AccountFormModal } from "../components/AccountFormModal";
import type { AccountFormValues } from "../components/AccountForm";
import { PageHeader } from "../ui/PageHeader";

function defaultFormValues(preferredCurrency: string): AccountFormValues {
  return {
    name: "",
    type: "Checking",
    currencyCode: preferredCurrency,
    openingBalance: "0",
    institutionName: "",
    accountNumberMasked: "",
    iconKind: "Bank"
  };
}

function accountToFormValues(account: Account): AccountFormValues {
  return {
    name: account.name,
    type: account.type,
    currencyCode: account.currencyCode,
    openingBalance: String(account.openingBalance),
    institutionName: account.institutionName ?? "",
    accountNumberMasked: account.accountNumberMasked ?? "",
    iconKind: account.iconKind,
    isActive: account.isActive
  };
}

export function AccountsPage() {
  const { accountId: routeAccountId } = useParams<{ accountId?: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { selectedMonth } = useMonthSelection();
  const { accounts, categories, transactions, profile, refresh } = useLedgerraData({
    accounts: true, categories: true, transactions: true, profile: true
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === routeAccountId) ?? (routeAccountId ? null : accounts[0] ?? null),
    [accounts, routeAccountId]
  );

  useEffect(() => {
    if (!routeAccountId && selectedAccount) {
      navigate(`/accounts/${selectedAccount.id}`, { replace: true });
    }
  }, [routeAccountId, selectedAccount, navigate]);

  const accountTransactions = useMemo(
    () => transactions.filter((tx) => tx.accountId === selectedAccount?.id),
    [transactions, selectedAccount?.id]
  );

  const createInitialValues = useMemo(
    () => defaultFormValues(profile?.preferredCurrencyCode ?? "PLN"),
    [profile?.preferredCurrencyCode]
  );

  const editInitialValues = useMemo(
    () => (selectedAccount ? accountToFormValues(selectedAccount) : defaultFormValues("PLN")),
    [selectedAccount]
  );

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={t("accounts.eyebrow")}
        title={t("accounts.title")}
        description={t("accounts.description")}
      />

      <div className="accounts-shell">
        <AccountListColumn
          accounts={accounts}
          selectedAccountId={selectedAccount?.id ?? null}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onSelectAccount={(id) => navigate(`/accounts/${id}`)}
          onAddAccount={() => setCreateOpen(true)}
        />

        {selectedAccount ? (
          <AccountDetailColumn
            account={selectedAccount}
            transactions={accountTransactions}
            categories={categories}
            selectedMonth={selectedMonth}
            onEdit={() => setEditOpen(true)}
            onTransfer={() => navigate(`/transactions?accountId=${selectedAccount.id}&form=transfer`)}
          />
        ) : (
          <section className="account-detail-column account-detail-empty">
            <p>{t("accounts.eyebrow")}</p>
            <h2>{t("accounts.title")}</h2>
            <p>{t("accounts.description")}</p>
          </section>
        )}
      </div>

      <AccountFormModal
        open={createOpen}
        mode="create"
        initialValues={createInitialValues}
        onClose={() => setCreateOpen(false)}
        onSaved={async (acc) => {
          await refresh();
          navigate(`/accounts/${acc.id}`);
        }}
      />

      {selectedAccount && (
        <AccountFormModal
          open={editOpen}
          mode="edit"
          accountId={selectedAccount.id}
          initialValues={editInitialValues}
          onClose={() => setEditOpen(false)}
          onSaved={async () => { await refresh(); }}
        />
      )}
    </div>
  );
}
