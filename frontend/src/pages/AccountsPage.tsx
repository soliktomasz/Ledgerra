import { FormEvent, useState } from "react";
import { apiClient } from "../api/client";
import { useLedgerraData } from "../hooks/useLedgerraData";
import { useAuth } from "../state/AuthContext";
import { PageHeader } from "../ui/PageHeader";
import { SectionCard } from "../ui/SectionCard";
import { formatCurrency } from "../utils/format";

const accountTypes = ["Checking", "Savings", "Cash", "Credit", "Joint"];

export function AccountsPage() {
  const { auth } = useAuth();
  const { accounts, refresh } = useLedgerraData();
  const [name, setName] = useState("");
  const [type, setType] = useState("Checking");
  const [openingBalance, setOpeningBalance] = useState("0");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!auth?.accessToken) {
      return;
    }

    await apiClient.createAccount(auth.accessToken, {
      name,
      type,
      currencyCode: "USD",
      openingBalance: Number(openingBalance)
    });

    setName("");
    setType("Checking");
    setOpeningBalance("0");
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
            <button className="primary-button" type="submit">
              Add account
            </button>
          </form>
        </SectionCard>

        <SectionCard title="Current accounts">
          <div className="table-list">
            {accounts.map((account) => (
              <article key={account.id} className="table-row">
                <div>
                  <strong>{account.name}</strong>
                  <p>{account.type}</p>
                </div>
                <div className="align-right">
                  <strong>{formatCurrency(account.currentBalance, account.currencyCode)}</strong>
                  <p>Opening {formatCurrency(account.openingBalance, account.currencyCode)}</p>
                </div>
              </article>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
