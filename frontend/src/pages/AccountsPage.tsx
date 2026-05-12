import { FormEvent, useEffect, useState } from "react";
import { apiClient } from "../api/client";
import { useLedgerraData } from "../hooks/useLedgerraData";
import { useAuth } from "../state/AuthContext";
import { useI18n } from "../state/I18nContext";
import { PageHeader } from "../ui/PageHeader";
import { SectionCard } from "../ui/SectionCard";
import { normalizeCurrencyCode, supportedCurrencies } from "../utils/currency";
import { formatCurrency } from "../utils/format";

const accountTypes = ["Checking", "Savings", "Cash", "Credit", "Joint"];

function getAccountTypeLabel(type: string, t: ReturnType<typeof useI18n>["t"]) {
  switch (type) {
    case "Checking":
      return t("accountType.Checking");
    case "Savings":
      return t("accountType.Savings");
    case "Cash":
      return t("accountType.Cash");
    case "Credit":
      return t("accountType.Credit");
    case "Joint":
      return t("accountType.Joint");
    default:
      return type;
  }
}

export function AccountsPage() {
  const { auth } = useAuth();
  const { t } = useI18n();
  const { accounts, profile, refresh } = useLedgerraData({
    accounts: true,
    profile: true
  });
  const [name, setName] = useState("");
  const [type, setType] = useState("Checking");
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [accountCurrencyDraft, setAccountCurrencyDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    setCurrencyCode(profile?.preferredCurrencyCode ?? "USD");
  }, [profile?.preferredCurrencyCode]);

  useEffect(() => {
    setAccountCurrencyDraft(Object.fromEntries(accounts.map((account) => [account.id, account.currencyCode])));
  }, [accounts]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!auth?.accessToken) {
      return;
    }

    await apiClient.createAccount(auth.accessToken, {
      name,
      type,
      currencyCode: normalizeCurrencyCode(currencyCode),
      openingBalance: Number(openingBalance),
      institutionName: null,
      accountNumberMasked: null,
      iconKind: "Bank"
    });

    setName("");
    setType("Checking");
    setCurrencyCode(profile?.preferredCurrencyCode ?? "USD");
    setOpeningBalance("0");
    await refresh();
  };

  const handleAccountCurrencySave = async (accountId: string) => {
    if (!auth?.accessToken) {
      return;
    }

    const account = accounts.find((item) => item.id === accountId);
    if (!account) {
      return;
    }

    await apiClient.updateAccount(auth.accessToken, {
      ...account,
      currencyCode: normalizeCurrencyCode(accountCurrencyDraft[account.id] ?? account.currencyCode)
    });
    await refresh();
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={t("accounts.eyebrow")}
        title={t("accounts.title")}
        description={t("accounts.description")}
      />

      <div className="split-grid">
        <SectionCard title={t("accounts.createAccount")}>
          <form className="stack-form" onSubmit={handleSubmit}>
            <label>
              {t("accounts.name")}
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <label>
              {t("accounts.type")}
              <select value={type} onChange={(event) => setType(event.target.value)}>
                {accountTypes.map((option) => (
                  <option key={option} value={option}>
                    {getAccountTypeLabel(option, t)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("accounts.openingBalance")}
              <input value={openingBalance} onChange={(event) => setOpeningBalance(event.target.value)} type="number" step="0.01" />
            </label>
            <label>
              {t("accounts.currency")}
              <select value={currencyCode} onChange={(event) => setCurrencyCode(event.target.value)}>
                {supportedCurrencies.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.label}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-button" type="submit">
              {t("accounts.addAccount")}
            </button>
          </form>
        </SectionCard>

        <SectionCard title={t("accounts.currentAccounts")}>
          <div className="table-list">
            {accounts.map((account) => (
              <article key={account.id} className="table-row account-settings-row">
                <div>
                  <strong>{account.name}</strong>
                  <p>{getAccountTypeLabel(account.type, t)}</p>
                </div>
                <div className="align-right">
                  <strong>{formatCurrency(account.currentBalance, account.currencyCode)}</strong>
                  <p>{t("accounts.opening", { amount: formatCurrency(account.openingBalance, account.currencyCode) })}</p>
                </div>
                <form
                  className="inline-settings-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleAccountCurrencySave(account.id);
                  }}
                >
                  <label>
                    {t("accounts.currency")}
                    <select
                      value={accountCurrencyDraft[account.id] ?? account.currencyCode}
                      onChange={(event) =>
                        setAccountCurrencyDraft((current) => ({
                          ...current,
                          [account.id]: event.target.value
                        }))
                      }
                    >
                      {supportedCurrencies.map((currency) => (
                        <option key={currency.code} value={currency.code}>
                          {currency.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="ghost-button" type="submit">
                    {t("common.save")}
                  </button>
                </form>
              </article>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
