import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient } from "../api/client";
import { TransactionForm, toDateTimeLocal, toFormType, type TransactionFormMode, type TransactionFormValues } from "../components/TransactionForm";
import { useLedgerraData } from "../hooks/useLedgerraData";
import { useAuth } from "../state/AuthContext";
import { useI18n } from "../state/I18nContext";
import type { Transaction } from "../types";
import { PageHeader } from "../ui/PageHeader";
import { SectionCard } from "../ui/SectionCard";
import { formatCurrency, formatDate } from "../utils/format";

const transactionTypes = ["Expense", "Income", "Transfer"];

function getTransactionTypeLabel(type: string, t: ReturnType<typeof useI18n>["t"]) {
  switch (type) {
    case "Expense":
      return t("transactionType.Expense");
    case "Income":
      return t("transactionType.Income");
    case "Transfer":
      return t("transactionType.Transfer");
    default:
      return type;
  }
}

function transactionLabel(transaction: Transaction, t: ReturnType<typeof useI18n>["t"], categoryName?: string) {
  return transaction.note?.trim() || categoryName || getTransactionTypeLabel(transaction.type, t);
}

export function TransactionsPage() {
  const { auth } = useAuth();
  const { t } = useI18n();
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
      setErrorMessage(caughtError instanceof Error ? caughtError.message : t("transactions.unableToLoad"));
    }
  }, [auth?.accessToken, filterQuery, t]);

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
      setStatusMessage(t("transactions.chooseDestination"));
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
      setStatusMessage(t("transactions.duplicated"));
      await refreshAfterMutation();
    } catch (caughtError) {
      setErrorMessage(caughtError instanceof Error ? caughtError.message : t("transactions.unableToDuplicate"));
    }
  };

  const deleteTransaction = async (transaction: Transaction) => {
    if (!auth?.accessToken) {
      return;
    }

    try {
      setErrorMessage("");
      await apiClient.deleteTransaction(auth.accessToken, transaction.id);
      setStatusMessage(t("transactions.deleted"));
      if (editingTransactionId === transaction.id) {
        resetForm();
      }
      await refreshAfterMutation();
    } catch (caughtError) {
      setErrorMessage(caughtError instanceof Error ? caughtError.message : t("transactions.unableToDelete"));
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
      setStatusMessage(t("transactions.categorizedAs", { label: transactionLabel(transaction, t, category?.name), category: category?.name ?? t("transactions.selectedCategory") }));
      await refreshAfterMutation();
    } catch (caughtError) {
      setErrorMessage(caughtError instanceof Error ? caughtError.message : t("transactions.unableToCategorize"));
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={t("transactions.eyebrow")}
        title={t("transactions.title")}
        description={t("transactions.description")}
      />

      <div className="split-grid wide">
        <SectionCard title={formMode === "edit" ? t("transactions.editTransaction") : t("transactions.addTransaction")}>
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

        <SectionCard title={t("transactions.ledger")}>
          <div className="transaction-filters">
            <label>
              {t("transactions.filterByAccount")}
              <select value={filterAccountId} onChange={(event) => setFilterAccountId(event.target.value)}>
                <option value="">{t("common.allAccounts")}</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("transactions.filterByCategory")}
              <select value={filterCategoryId} onChange={(event) => setFilterCategoryId(event.target.value)} disabled={filterType === "Transfer"}>
                <option value="">{t("common.allCategories")}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("transactions.filterByType")}
              <select value={filterType} onChange={(event) => setFilterType(event.target.value)}>
                <option value="">{t("common.allTypes")}</option>
                {transactionTypes.map((option) => (
                  <option key={option} value={option}>
                    {getTransactionTypeLabel(option, t)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("transactions.fromDate")}
              <input value={fromDate} onChange={(event) => setFromDate(event.target.value)} type="date" />
            </label>
            <label>
              {t("transactions.toDate")}
              <input value={toDate} onChange={(event) => setToDate(event.target.value)} type="date" />
            </label>
            <label>
              {t("transactions.searchNotes")}
              <input value={noteSearch} onChange={(event) => setNoteSearch(event.target.value)} placeholder={t("transactions.searchPlaceholder")} />
            </label>
            <label className="inline-checkbox">
              <input
                checked={showUncategorizedOnly}
                onChange={(event) => setShowUncategorizedOnly(event.target.checked)}
                type="checkbox"
              />
              {t("transactions.needsCategory")}
            </label>
          </div>

          {showUncategorizedOnly ? (
            <p className="workflow-banner">
              {t("transactions.workflowBanner", { count: uncategorizedExpenseCount })}
            </p>
          ) : null}

          <div className="table-list transaction-list">
            {visibleTransactions.length === 0 ? (
              <p className="empty-state">{t("transactions.noMatches")}</p>
            ) : (
              visibleTransactions.map((transaction) => {
                const account = accounts.find((item) => item.id === transaction.accountId);
                const category = categories.find((item) => item.id === transaction.categoryId);
                const label = transactionLabel(transaction, t, category?.name);

                return (
                  <article className="table-row transaction-row" key={transaction.id} aria-label={`Transaction ${label}`}>
                    <div className="transaction-main">
                      <strong>{category?.name ?? getTransactionTypeLabel(toFormType(transaction.type), t)}</strong>
                      <p>{account?.name ?? t("transactions.unknownAccount")} • {formatDate(transaction.occurredOnUtc)}</p>
                      {transaction.note ? <p className="transaction-note">{transaction.note}</p> : null}
                    </div>
                    <div className="align-right transaction-amount">
                      <strong>{formatCurrency(transaction.amount, account?.currencyCode)}</strong>
                      <p>{getTransactionTypeLabel(transaction.type, t)}</p>
                    </div>
                    <div className="transaction-actions">
                      {!transaction.categoryId && transaction.type === "Expense" ? (
                        <label className="quick-category-control">
                          {t("transactions.assignCategoryTo", { label })}
                          <select
                            aria-label={t("transactions.assignCategoryTo", { label })}
                            value=""
                            onChange={(event) => void assignTransactionCategory(transaction, event.target.value)}
                          >
                            <option value="">{t("common.chooseCategory")}</option>
                            {expenseCategories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                      <button className="ghost-button compact-button" type="button" onClick={() => startEdit(transaction)} aria-label={`${t("transactions.edit")} ${label}`}>
                        {t("transactions.edit")}
                      </button>
                      <button
                        className="ghost-button compact-button"
                        type="button"
                        onClick={() => void duplicateTransaction(transaction)}
                        aria-label={`${t("transactions.duplicate")} ${label}`}
                      >
                        {t("transactions.duplicate")}
                      </button>
                      <button
                        className="ghost-button compact-button danger-button"
                        type="button"
                        onClick={() => void deleteTransaction(transaction)}
                        aria-label={`${t("transactions.delete")} ${label}`}
                      >
                        {t("transactions.delete")}
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
