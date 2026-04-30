import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { apiClient } from "../api/client";
import { useLedgerraData } from "../hooks/useLedgerraData";
import { useAuth } from "../state/AuthContext";
import type { Transaction } from "../types";
import { PageHeader } from "../ui/PageHeader";
import { SectionCard } from "../ui/SectionCard";
import { formatCurrency, formatDate } from "../utils/format";

const transactionTypes = ["Expense", "Income", "Transfer"];

type TransactionFormMode = "create" | "edit";

function toDateTimeLocal(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 16);
  }

  return date.toISOString().slice(0, 16);
}

function toFormType(type: string) {
  return type.startsWith("Transfer") ? "Transfer" : type;
}

function transactionLabel(transaction: Transaction, categoryName?: string) {
  return transaction.note?.trim() || categoryName || transaction.type;
}

export function TransactionsPage() {
  const { auth } = useAuth();
  const { accounts, categories, transactions, refresh } = useLedgerraData();
  const [formMode, setFormMode] = useState<TransactionFormMode>("create");
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [type, setType] = useState("Expense");
  const [accountId, setAccountId] = useState("");
  const [destinationAccountId, setDestinationAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("0");
  const [occurredOnUtc, setOccurredOnUtc] = useState(new Date().toISOString().slice(0, 16));
  const [note, setNote] = useState("");
  const [filterAccountId, setFilterAccountId] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [filterType, setFilterType] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [noteSearch, setNoteSearch] = useState("");
  const [ledgerTransactions, setLedgerTransactions] = useState<Transaction[]>(transactions);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setLedgerTransactions(transactions);
  }, [transactions]);

  const filteredCategories = useMemo(() => {
    if (type === "Income") {
      return categories.filter((category) => category.kind === "Income");
    }

    if (type === "Transfer") {
      return [];
    }

    return categories.filter((category) => category.kind === "Expense");
  }, [categories, type]);

  const filterQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (filterAccountId) {
      params.set("accountId", filterAccountId);
    }
    if (filterCategoryId && filterType !== "Transfer") {
      params.set("categoryId", filterCategoryId);
    }
    if (filterType && filterType !== "Transfer") {
      params.set("type", filterType);
    }
    if (fromDate) {
      params.set("from", fromDate);
    }
    if (toDate) {
      params.set("to", toDate);
    }

    const query = params.toString();
    return query ? `?${query}` : "";
  }, [filterAccountId, filterCategoryId, filterType, fromDate, toDate]);

  const loadTransactions = useCallback(async () => {
    if (!auth?.accessToken) {
      return;
    }

    try {
      setErrorMessage("");
      const payload = await apiClient.getTransactions(auth.accessToken, filterQuery);
      setLedgerTransactions(payload);
    } catch (caughtError) {
      setErrorMessage(caughtError instanceof Error ? caughtError.message : "Unable to load transactions.");
    }
  }, [auth?.accessToken, filterQuery]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const visibleTransactions = useMemo(() => {
    const normalizedSearch = noteSearch.trim().toLowerCase();
    return ledgerTransactions.filter((transaction) => {
      if (filterType === "Transfer" && !transaction.type.startsWith("Transfer")) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return (transaction.note ?? "").toLowerCase().includes(normalizedSearch);
    });
  }, [filterType, ledgerTransactions, noteSearch]);

  const resetForm = () => {
    setFormMode("create");
    setEditingTransactionId(null);
    setType("Expense");
    setAccountId("");
    setDestinationAccountId("");
    setCategoryId("");
    setAmount("0");
    setOccurredOnUtc(new Date().toISOString().slice(0, 16));
    setNote("");
  };

  const refreshAfterMutation = async () => {
    await refresh();
    await loadTransactions();
  };

  const buildCreatePayload = () => ({
    accountId,
    categoryId: categoryId || undefined,
    destinationAccountId: type === "Transfer" ? destinationAccountId : undefined,
    amount: Number(amount),
    type,
    occurredOnUtc: new Date(occurredOnUtc).toISOString(),
    note: note.trim() || undefined
  });

  const buildUpdatePayload = () => ({
    categoryId: categoryId || undefined,
    destinationAccountId: type === "Transfer" ? destinationAccountId : undefined,
    amount: Number(amount),
    type,
    occurredOnUtc: new Date(occurredOnUtc).toISOString(),
    note: note.trim() || undefined
  });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!auth?.accessToken || !accountId) {
      return;
    }

    try {
      setErrorMessage("");
      setStatusMessage("");
      if (formMode === "edit" && editingTransactionId) {
        await apiClient.updateTransaction(auth.accessToken, editingTransactionId, buildUpdatePayload());
        setStatusMessage("Transaction updated.");
      } else {
        await apiClient.createTransaction(auth.accessToken, buildCreatePayload());
        setStatusMessage("Transaction saved.");
      }

      resetForm();
      await refreshAfterMutation();
    } catch (caughtError) {
      setErrorMessage(caughtError instanceof Error ? caughtError.message : "Unable to save transaction.");
    }
  };

  const startEdit = (transaction: Transaction) => {
    setFormMode("edit");
    setEditingTransactionId(transaction.id);
    setType(toFormType(transaction.type));
    setAccountId(transaction.accountId);
    setDestinationAccountId("");
    setCategoryId(transaction.categoryId ?? "");
    setAmount(String(transaction.amount));
    setOccurredOnUtc(toDateTimeLocal(transaction.occurredOnUtc));
    setNote(transaction.note ?? "");
    setStatusMessage("");
    setErrorMessage("");
  };

  const duplicateTransaction = async (transaction: Transaction) => {
    if (!auth?.accessToken) {
      return;
    }

    if (transaction.type.startsWith("Transfer")) {
      setFormMode("create");
      setType("Transfer");
      setAccountId(transaction.accountId);
      setDestinationAccountId("");
      setAmount(String(transaction.amount));
      setOccurredOnUtc(toDateTimeLocal(transaction.occurredOnUtc));
      setNote(transaction.note ?? "");
      setStatusMessage("Choose a destination account to duplicate this transfer.");
      return;
    }

    try {
      setErrorMessage("");
      await apiClient.createTransaction(auth.accessToken, {
        accountId: transaction.accountId,
        categoryId: transaction.categoryId ?? undefined,
        amount: transaction.amount,
        type: transaction.type,
        occurredOnUtc: transaction.occurredOnUtc,
        note: transaction.note ?? undefined
      });
      setStatusMessage("Transaction duplicated.");
      await refreshAfterMutation();
    } catch (caughtError) {
      setErrorMessage(caughtError instanceof Error ? caughtError.message : "Unable to duplicate transaction.");
    }
  };

  const deleteTransaction = async (transaction: Transaction) => {
    if (!auth?.accessToken) {
      return;
    }

    try {
      setErrorMessage("");
      await apiClient.deleteTransaction(auth.accessToken, transaction.id);
      setStatusMessage("Transaction deleted.");
      if (editingTransactionId === transaction.id) {
        resetForm();
      }
      await refreshAfterMutation();
    } catch (caughtError) {
      setErrorMessage(caughtError instanceof Error ? caughtError.message : "Unable to delete transaction.");
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Transactions"
        title="Record what actually happened"
        description="Capture income, spending, and transfers with enough structure to trust your reports."
      />

      <div className="split-grid wide">
        <SectionCard title={formMode === "edit" ? "Edit transaction" : "Add transaction"}>
          {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
          {statusMessage ? <p className="success-banner">{statusMessage}</p> : null}
          <form className="stack-form" onSubmit={handleSubmit}>
            <label>
              Type
              <select
                value={type}
                onChange={(event) => {
                  setType(event.target.value);
                  setCategoryId("");
                  setDestinationAccountId("");
                }}
              >
                {transactionTypes.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Account
              <select value={accountId} onChange={(event) => setAccountId(event.target.value)} required disabled={formMode === "edit"}>
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
            <div className="transaction-form-actions">
              <button className="primary-button" type="submit">
                {formMode === "edit" ? "Save changes" : "Save transaction"}
              </button>
              {formMode === "edit" ? (
                <button className="ghost-button" type="button" onClick={resetForm}>
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Transaction ledger">
          <div className="transaction-filters">
            <label>
              Filter by account
              <select value={filterAccountId} onChange={(event) => setFilterAccountId(event.target.value)}>
                <option value="">All accounts</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Filter by category
              <select value={filterCategoryId} onChange={(event) => setFilterCategoryId(event.target.value)} disabled={filterType === "Transfer"}>
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Filter by type
              <select value={filterType} onChange={(event) => setFilterType(event.target.value)}>
                <option value="">All types</option>
                {transactionTypes.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label>
              From date
              <input value={fromDate} onChange={(event) => setFromDate(event.target.value)} type="date" />
            </label>
            <label>
              To date
              <input value={toDate} onChange={(event) => setToDate(event.target.value)} type="date" />
            </label>
            <label>
              Search notes
              <input value={noteSearch} onChange={(event) => setNoteSearch(event.target.value)} placeholder="Coffee, payroll, invoice..." />
            </label>
          </div>

          <div className="table-list transaction-list">
            {visibleTransactions.length === 0 ? (
              <p className="empty-state">No transactions match these filters.</p>
            ) : (
              visibleTransactions.map((transaction) => {
                const account = accounts.find((item) => item.id === transaction.accountId);
                const category = categories.find((item) => item.id === transaction.categoryId);
                const label = transactionLabel(transaction, category?.name);

                return (
                  <article className="table-row transaction-row" key={transaction.id} aria-label={`Transaction ${label}`}>
                    <div className="transaction-main">
                      <strong>{category?.name ?? toFormType(transaction.type)}</strong>
                      <p>{account?.name ?? "Unknown account"} • {formatDate(transaction.occurredOnUtc)}</p>
                      {transaction.note ? <p className="transaction-note">{transaction.note}</p> : null}
                    </div>
                    <div className="align-right transaction-amount">
                      <strong>{formatCurrency(transaction.amount, account?.currencyCode)}</strong>
                      <p>{transaction.type}</p>
                    </div>
                    <div className="transaction-actions">
                      <button className="ghost-button compact-button" type="button" onClick={() => startEdit(transaction)} aria-label={`Edit ${label}`}>
                        Edit
                      </button>
                      <button
                        className="ghost-button compact-button"
                        type="button"
                        onClick={() => void duplicateTransaction(transaction)}
                        aria-label={`Duplicate ${label}`}
                      >
                        Duplicate
                      </button>
                      <button
                        className="ghost-button compact-button danger-button"
                        type="button"
                        onClick={() => void deleteTransaction(transaction)}
                        aria-label={`Delete ${label}`}
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
