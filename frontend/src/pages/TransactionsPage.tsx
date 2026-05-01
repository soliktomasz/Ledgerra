import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient } from "../api/client";
import { TransactionForm, toDateTimeLocal, toFormType, type TransactionFormMode, type TransactionFormValues } from "../components/TransactionForm";
import { useLedgerraData } from "../hooks/useLedgerraData";
import { useAuth } from "../state/AuthContext";
import type { Transaction } from "../types";
import { PageHeader } from "../ui/PageHeader";
import { SectionCard } from "../ui/SectionCard";
import { formatCurrency, formatDate } from "../utils/format";

const transactionTypes = ["Expense", "Income", "Transfer"];

function transactionLabel(transaction: Transaction, categoryName?: string) {
  return transaction.note?.trim() || categoryName || transaction.type;
}

export function TransactionsPage() {
  const { auth } = useAuth();
  const { accounts, categories, transactions, refresh } = useLedgerraData();
  const [formMode, setFormMode] = useState<TransactionFormMode>("create");
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Partial<TransactionFormValues>>({});
  const [filterAccountId, setFilterAccountId] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [filterType, setFilterType] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [noteSearch, setNoteSearch] = useState("");
  const [showUncategorizedOnly, setShowUncategorizedOnly] = useState(() => new URLSearchParams(window.location.search).get("view") === "uncategorized");
  const [ledgerTransactions, setLedgerTransactions] = useState<Transaction[]>(transactions);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setLedgerTransactions(transactions);
  }, [transactions]);

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

      if (showUncategorizedOnly && (transaction.type !== "Expense" || transaction.categoryId)) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return (transaction.note ?? "").toLowerCase().includes(normalizedSearch);
    });
  }, [filterType, ledgerTransactions, noteSearch, showUncategorizedOnly]);

  const expenseCategories = useMemo(
    () => categories.filter((category) => category.kind === "Expense"),
    [categories]
  );
  const uncategorizedExpenseCount = useMemo(
    () => ledgerTransactions.filter((transaction) => transaction.type === "Expense" && !transaction.categoryId).length,
    [ledgerTransactions]
  );

  const resetForm = () => {
    setFormMode("create");
    setEditingTransactionId(null);
    setFormValues({});
  };

  const refreshAfterMutation = async () => {
    await refresh();
    await loadTransactions();
  };

  const startEdit = (transaction: Transaction) => {
    setFormMode("edit");
    setEditingTransactionId(transaction.id);
    setFormValues({
      type: toFormType(transaction.type),
      accountId: transaction.accountId,
      destinationAccountId: "",
      categoryId: transaction.categoryId ?? "",
      amount: String(transaction.amount),
      occurredOnUtc: toDateTimeLocal(transaction.occurredOnUtc),
      note: transaction.note ?? ""
    });
    setStatusMessage("");
    setErrorMessage("");
  };

  const duplicateTransaction = async (transaction: Transaction) => {
    if (!auth?.accessToken) {
      return;
    }

    if (transaction.type.startsWith("Transfer")) {
      setFormMode("create");
      setFormValues({
        type: "Transfer",
        accountId: transaction.accountId,
        destinationAccountId: "",
        amount: String(transaction.amount),
        occurredOnUtc: toDateTimeLocal(transaction.occurredOnUtc),
        note: transaction.note ?? ""
      });
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

  const assignTransactionCategory = async (transaction: Transaction, nextCategoryId: string) => {
    if (!auth?.accessToken || !nextCategoryId) {
      return;
    }

    const category = categories.find((item) => item.id === nextCategoryId);

    try {
      setErrorMessage("");
      setStatusMessage("");
      await apiClient.updateTransaction(auth.accessToken, transaction.id, {
        categoryId: nextCategoryId,
        amount: transaction.amount,
        type: transaction.type,
        occurredOnUtc: transaction.occurredOnUtc,
        note: transaction.note?.trim() || undefined
      });
      setStatusMessage(`${transactionLabel(transaction, category?.name)} categorized as ${category?.name ?? "selected category"}.`);
      await refreshAfterMutation();
    } catch (caughtError) {
      setErrorMessage(caughtError instanceof Error ? caughtError.message : "Unable to categorize transaction.");
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
          {auth?.accessToken ? (
            <TransactionForm
              key={`${formMode}-${editingTransactionId ?? "new"}`}
              token={auth.accessToken}
              accounts={accounts}
              categories={categories}
              mode={formMode}
              transactionId={editingTransactionId}
              initialValues={formValues}
              onCancel={formMode === "edit" ? resetForm : undefined}
              onError={setErrorMessage}
              onStatus={setStatusMessage}
              onSaved={async () => {
                resetForm();
                await refreshAfterMutation();
              }}
            />
          ) : null}
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
            <label className="inline-checkbox">
              <input
                checked={showUncategorizedOnly}
                onChange={(event) => setShowUncategorizedOnly(event.target.checked)}
                type="checkbox"
              />
              Needs category
            </label>
          </div>

          {showUncategorizedOnly ? (
            <p className="workflow-banner">
              {uncategorizedExpenseCount} uncategorized expense {uncategorizedExpenseCount === 1 ? "needs" : "need"} review.
            </p>
          ) : null}

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
                      {!transaction.categoryId && transaction.type === "Expense" ? (
                        <label className="quick-category-control">
                          Assign category to {label}
                          <select
                            aria-label={`Assign category to ${label}`}
                            value=""
                            onChange={(event) => void assignTransactionCategory(transaction, event.target.value)}
                          >
                            <option value="">Choose category</option>
                            {expenseCategories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
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
