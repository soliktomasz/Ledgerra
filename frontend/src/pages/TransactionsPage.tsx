import { FormEvent, useMemo, useState } from "react";
import { apiClient } from "../api/client";
import { useLedgerraData } from "../hooks/useLedgerraData";
import { useAuth } from "../state/AuthContext";
import { PageHeader } from "../ui/PageHeader";
import { SectionCard } from "../ui/SectionCard";
import { formatCurrency, formatDate } from "../utils/format";

export function TransactionsPage() {
  const { auth } = useAuth();
  const { accounts, categories, transactions, refresh } = useLedgerraData();
  const [type, setType] = useState("Expense");
  const [accountId, setAccountId] = useState("");
  const [destinationAccountId, setDestinationAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("0");
  const [occurredOnUtc, setOccurredOnUtc] = useState(new Date().toISOString().slice(0, 16));
  const [note, setNote] = useState("");

  const filteredCategories = useMemo(() => {
    if (type === "Income") {
      return categories.filter((category) => category.kind === "Income");
    }

    if (type === "Transfer") {
      return [];
    }

    return categories.filter((category) => category.kind === "Expense");
  }, [categories, type]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!auth?.accessToken || !accountId) {
      return;
    }

    await apiClient.createTransaction(auth.accessToken, {
      accountId,
      categoryId: categoryId || undefined,
      destinationAccountId: type === "Transfer" ? destinationAccountId : undefined,
      amount: Number(amount),
      type,
      occurredOnUtc: new Date(occurredOnUtc).toISOString(),
      note
    });

    setAmount("0");
    setNote("");
    setCategoryId("");
    setDestinationAccountId("");
    await refresh();
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Transactions"
        title="Record what actually happened"
        description="Capture income, spending, and transfers with enough structure to trust your reports."
      />

      <div className="split-grid wide">
        <SectionCard title="Add transaction">
          <form className="stack-form" onSubmit={handleSubmit}>
            <label>
              Type
              <select value={type} onChange={(event) => setType(event.target.value)}>
                <option>Expense</option>
                <option>Income</option>
                <option>Transfer</option>
              </select>
            </label>
            <label>
              Account
              <select value={accountId} onChange={(event) => setAccountId(event.target.value)} required>
                <option value="">Select account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>

            {type === "Transfer" ? (
              <label>
                Destination account
                <select value={destinationAccountId} onChange={(event) => setDestinationAccountId(event.target.value)} required>
                  <option value="">Select destination</option>
                  {accounts
                    .filter((account) => account.id !== accountId)
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                </select>
              </label>
            ) : (
              <label>
                Category
                <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                  <option value="">Select category</option>
                  {filteredCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label>
              Amount
              <input value={amount} onChange={(event) => setAmount(event.target.value)} type="number" step="0.01" required />
            </label>
            <label>
              Date and time
              <input value={occurredOnUtc} onChange={(event) => setOccurredOnUtc(event.target.value)} type="datetime-local" required />
            </label>
            <label>
              Note
              <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
            </label>
            <button className="primary-button" type="submit">
              Save transaction
            </button>
          </form>
        </SectionCard>

        <SectionCard title="Recent activity">
          <div className="table-list">
            {transactions.map((transaction) => {
              const account = accounts.find((item) => item.id === transaction.accountId);
              const category = categories.find((item) => item.id === transaction.categoryId);

              return (
                <article className="table-row" key={transaction.id}>
                  <div>
                    <strong>{category?.name ?? transaction.type}</strong>
                    <p>{account?.name ?? "Unknown account"} • {formatDate(transaction.occurredOnUtc)}</p>
                  </div>
                  <div className="align-right">
                    <strong>{formatCurrency(transaction.amount)}</strong>
                    <p>{transaction.type}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
