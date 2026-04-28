import { FormEvent, useEffect, useState } from "react";
import { apiClient } from "../api/client";
import { useLedgerraData } from "../hooks/useLedgerraData";
import { useAuth } from "../state/AuthContext";
import { PageHeader } from "../ui/PageHeader";
import { SectionCard } from "../ui/SectionCard";
import { normalizeCurrencyCode, supportedCurrencies } from "../utils/currency";
import { formatCurrency } from "../utils/format";

const accountTypes = ["Checking", "Savings", "Cash", "Credit", "Joint"];

export function AccountsPage() {
  const { auth } = useAuth();
  const { accounts, profile, refresh } = useLedgerraData();
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
      openingBalance: Number(openingBalance)
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
        eyebrow="Accounts"
        title="Separate every pool of money"
        description="Track personal, shared, cash, and savings balances with clean visibility."
      />

      <div className="split-grid">
        <SectionCard title="Create account">
          <form className="stack-form" onSubmit={handleSubmit}>
            <label>
              Name
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <label>
              Type
              <select value={type} onChange={(event) => setType(event.target.value)}>
                {accountTypes.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Opening balance
              <input value={openingBalance} onChange={(event) => setOpeningBalance(event.target.value)} type="number" step="0.01" />
            </label>
            <label>
              Currency
              <select value={currencyCode} onChange={(event) => setCurrencyCode(event.target.value)}>
                {supportedCurrencies.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.label}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-button" type="submit">
              Add account
            </button>
          </form>
        </SectionCard>

        <SectionCard title="Current accounts">
          <div className="table-list">
            {accounts.map((account) => (
              <article key={account.id} className="table-row account-settings-row">
                <div>
                  <strong>{account.name}</strong>
                  <p>{account.type}</p>
                </div>
                <div className="align-right">
                  <strong>{formatCurrency(account.currentBalance, account.currencyCode)}</strong>
                  <p>Opening {formatCurrency(account.openingBalance, account.currencyCode)}</p>
                </div>
                <form
                  className="inline-settings-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleAccountCurrencySave(account.id);
                  }}
                >
                  <label>
                    Currency
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
                    Save
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
