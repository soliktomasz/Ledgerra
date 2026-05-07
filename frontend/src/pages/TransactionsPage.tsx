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

function escapeCsvValue(value: string | number | boolean | null | undefined) {
  const normalized = value == null ? "" : String(value);
  const escaped = normalized.replace(/"/g, "\"\"");
  return /[",\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
}

function toCsv(headers: string[], rows: Array<Array<string | number | boolean | null | undefined>>) {
  const csvRows = [headers, ...rows].map((row) => row.map((cell) => escapeCsvValue(cell)).join(","));
  return csvRows.join("\r\n");
}

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

function isTransferTransaction(transaction: Transaction) {
  return transaction.type.startsWith("Transfer");
}

function getCategorisableTransactionKind(transaction: Transaction) {
  return transaction.type === "Expense" || transaction.type === "Income" ? transaction.type : "";
}

export function TransactionsPage() {
  const { auth } = useAuth();
  const { t } = useI18n();
  const { accounts, categories, transactions, budget, refresh } = useLedgerraData();
  const [formMode, setFormMode] = useState<TransactionFormMode>("create");
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Partial<TransactionFormValues>>({});
  const initialQuery = useMemo(() => new URLSearchParams(window.location.search), []);
  const [filterAccountIds, setFilterAccountIds] = useState<string[]>(() => initialQuery.getAll("accountId"));
  const [filterCategoryIds, setFilterCategoryIds] = useState<string[]>(() => initialQuery.getAll("categoryId"));
  const [filterType, setFilterType] = useState(() => initialQuery.get("type") ?? "");
  const [fromDate, setFromDate] = useState(() => initialQuery.get("from") ?? "");
  const [toDate, setToDate] = useState(() => initialQuery.get("to") ?? "");
  const [minAmount, setMinAmount] = useState(() => initialQuery.get("minAmount") ?? "");
  const [maxAmount, setMaxAmount] = useState(() => initialQuery.get("maxAmount") ?? "");
  const [noteSearch, setNoteSearch] = useState(() => initialQuery.get("q") ?? "");
  const [showUncategorizedOnly, setShowUncategorizedOnly] = useState(() => initialQuery.get("view") === "uncategorized");
  const [ledgerTransactions, setLedgerTransactions] = useState<Transaction[]>(transactions);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([]);
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [bulkAccountId, setBulkAccountId] = useState("");
  const [isApplyingBulkAction, setIsApplyingBulkAction] = useState(false);

  useEffect(() => {
    setLedgerTransactions(transactions);
  }, [transactions]);

  const filterQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (filterAccountIds.length === 1) {
      params.set("accountId", filterAccountIds[0]);
    }
    if (filterCategoryIds.length === 1 && filterType !== "Transfer") {
      params.set("categoryId", filterCategoryIds[0]);
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
  }, [filterAccountIds, filterCategoryIds, filterType, fromDate, toDate]);

  useEffect(() => {
    const params = new URLSearchParams();
    filterAccountIds.forEach((id) => params.append("accountId", id));
    if (filterType !== "Transfer") {
      filterCategoryIds.forEach((id) => params.append("categoryId", id));
    }
    if (filterType) params.set("type", filterType);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    if (minAmount) params.set("minAmount", minAmount);
    if (maxAmount) params.set("maxAmount", maxAmount);
    if (noteSearch.trim()) params.set("q", noteSearch.trim());
    if (showUncategorizedOnly) params.set("view", "uncategorized");
    const query = params.toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  }, [filterAccountIds, filterCategoryIds, filterType, fromDate, toDate, minAmount, maxAmount, noteSearch, showUncategorizedOnly]);

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
    const min = minAmount ? Number(minAmount) : null;
    const max = maxAmount ? Number(maxAmount) : null;
    return ledgerTransactions.filter((transaction) => {
      if (filterType === "Transfer" && !transaction.type.startsWith("Transfer")) {
        return false;
      }
      if (filterAccountIds.length > 0 && !filterAccountIds.includes(transaction.accountId)) {
        return false;
      }
      if (filterType !== "Transfer" && filterCategoryIds.length > 0 && !filterCategoryIds.includes(transaction.categoryId ?? "")) {
        return false;
      }
      if (min !== null && transaction.amount < min) {
        return false;
      }
      if (max !== null && transaction.amount > max) {
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
  }, [filterType, filterAccountIds, filterCategoryIds, ledgerTransactions, minAmount, maxAmount, noteSearch, showUncategorizedOnly]);
  useEffect(() => {
    setSelectedTransactionIds((current) => current.filter((id) => visibleTransactions.some((transaction) => transaction.id === id)));
  }, [visibleTransactions]);

  const selectedTransactions = useMemo(
    () => visibleTransactions.filter((transaction) => selectedTransactionIds.includes(transaction.id)),
    [visibleTransactions, selectedTransactionIds]
  );
  const allVisibleSelected = visibleTransactions.length > 0 && selectedTransactionIds.length === visibleTransactions.length;
  const selectedCategorisableTransactions = useMemo(
    () => selectedTransactions.filter((transaction) => getCategorisableTransactionKind(transaction)),
    [selectedTransactions]
  );
  const bulkCategoryKind = useMemo(() => {
    const selectedKinds = new Set(selectedCategorisableTransactions.map(getCategorisableTransactionKind));
    return selectedKinds.size === 1 ? Array.from(selectedKinds)[0] : "";
  }, [selectedCategorisableTransactions]);

  const bulkCategories = useMemo(
    () => categories.filter((category) => bulkCategoryKind && category.kind === bulkCategoryKind),
    [bulkCategoryKind, categories]
  );
  useEffect(() => {
    if (bulkCategoryId && !bulkCategories.some((category) => category.id === bulkCategoryId)) {
      setBulkCategoryId("");
    }
  }, [bulkCategories, bulkCategoryId]);
  const expenseCategories = useMemo(
    () => categories.filter((category) => category.kind === "Expense"),
    [categories]
  );
  const uncategorizedExpenseCount = useMemo(
    () => ledgerTransactions.filter((transaction) => transaction.type === "Expense" && !transaction.categoryId).length,
    [ledgerTransactions]
  );

  const downloadCsv = (filename: string, csvContent: string) => {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const href = URL.createObjectURL(blob);
    link.href = href;
    link.setAttribute("download", filename);
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
  };

  const exportFilteredTransactions = () => {
    const rows = visibleTransactions.map((transaction) => {
      const account = accounts.find((item) => item.id === transaction.accountId);
      const category = categories.find((item) => item.id === transaction.categoryId);
      return [transaction.id, transaction.occurredOnUtc, transaction.type, transaction.amount, account?.name ?? "", account?.currencyCode ?? "", category?.name ?? "", transaction.note ?? ""];
    });
    const csv = toCsv(["id", "occurredOnUtc", "type", "amount", "account", "currency", "category", "note"], rows);
    downloadCsv(`transactions-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    setStatusMessage(`Exported ${visibleTransactions.length} filtered transactions.`);
  };

  const exportCategoriesAndBudgets = () => {
    const categoriesCsv = toCsv(
      ["id", "name", "kind", "isSystem"],
      categories.map((category) => [category.id, category.name, category.kind, category.isSystem])
    );
    downloadCsv(`categories-${new Date().toISOString().slice(0, 10)}.csv`, categoriesCsv);

    if (budget) {
      const budgetRows = budget.categories.map((category) => {
        const categoryName = category.categoryName || categories.find((item) => item.id === category.categoryId)?.name || "";
        return [category.categoryId, categoryName, category.planned, category.spent, category.remaining];
      });
      const budgetCsv = toCsv(["categoryId", "category", "planned", "spent", "remaining"], budgetRows);
      downloadCsv(`budget-${new Date().toISOString().slice(0, 10)}.csv`, budgetCsv);
    }

    setStatusMessage("Exported categories and budget data.");
  };

  const resetForm = () => {
    setFormMode("create");
    setEditingTransactionId(null);
    setFormValues({});
  };

  const refreshAfterMutation = async () => {
    await refresh();
    await loadTransactions();
  };
  const clearSelection = () => {
    setSelectedTransactionIds([]);
    setBulkCategoryId("");
    setBulkAccountId("");
  };
  const toggleTransactionSelection = (transactionId: string, selected: boolean) => {
    setSelectedTransactionIds((current) =>
      selected ? (current.includes(transactionId) ? current : [...current, transactionId]) : current.filter((id) => id !== transactionId)
    );
  };
  const toggleSelectAllVisible = (selected: boolean) => {
    setSelectedTransactionIds(selected ? visibleTransactions.map((transaction) => transaction.id) : []);
  };
  const getUniqueDeleteTargets = () => {
    const deleteTargets = new Map<string, Transaction>();
    selectedTransactions.forEach((transaction) => {
      const deleteKey = transaction.transferGroupId ? `transfer:${transaction.transferGroupId}` : `transaction:${transaction.id}`;
      if (!deleteTargets.has(deleteKey)) {
        deleteTargets.set(deleteKey, transaction);
      }
    });

    return Array.from(deleteTargets.values());
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

    if (isTransferTransaction(transaction)) {
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

  const bulkDeleteTransactions = async () => {
    if (!auth?.accessToken || selectedTransactions.length === 0) return;
    const deleteTargets = getUniqueDeleteTargets();
    try {
      setIsApplyingBulkAction(true);
      await Promise.all(deleteTargets.map((transaction) => apiClient.deleteTransaction(auth.accessToken, transaction.id)));
      setStatusMessage(`Deleted ${selectedTransactions.length} transactions.`);
      clearSelection();
      await refreshAfterMutation();
    } catch (caughtError) {
      setErrorMessage(caughtError instanceof Error ? caughtError.message : t("transactions.unableToDelete"));
    } finally {
      setIsApplyingBulkAction(false);
    }
  };
  const bulkAssignCategory = async () => {
    if (!auth?.accessToken || !bulkCategoryId || selectedCategorisableTransactions.length === 0 || !bulkCategoryKind) return;
    try {
      setIsApplyingBulkAction(true);
      await Promise.all(
        selectedCategorisableTransactions.map((transaction) =>
          apiClient.updateTransaction(auth.accessToken, transaction.id, {
            categoryId: bulkCategoryId,
            amount: transaction.amount,
            type: transaction.type,
            occurredOnUtc: transaction.occurredOnUtc,
            note: transaction.note?.trim() || undefined
          })
        )
      );
      setStatusMessage(`Updated category for ${selectedCategorisableTransactions.length} transactions.`);
      clearSelection();
      await refreshAfterMutation();
    } catch (caughtError) {
      setErrorMessage(caughtError instanceof Error ? caughtError.message : t("transactions.unableToCategorize"));
    } finally {
      setIsApplyingBulkAction(false);
    }
  };
  const bulkMoveAccount = async () => {
    if (!auth?.accessToken || !bulkAccountId || selectedTransactions.length === 0) return;
    const targets = selectedTransactions.filter((transaction) => !isTransferTransaction(transaction));
    try {
      setIsApplyingBulkAction(true);
      await Promise.all(
        targets.map(async (transaction) => {
          await apiClient.createTransaction(auth.accessToken, {
            accountId: bulkAccountId,
            categoryId: transaction.categoryId ?? undefined,
            amount: transaction.amount,
            type: transaction.type,
            occurredOnUtc: transaction.occurredOnUtc,
            note: transaction.note ?? undefined
          });
          await apiClient.deleteTransaction(auth.accessToken!, transaction.id);
        })
      );
      setStatusMessage(`Moved ${targets.length} transactions to the selected account.`);
      clearSelection();
      await refreshAfterMutation();
    } catch (caughtError) {
      setErrorMessage(caughtError instanceof Error ? caughtError.message : "Unable to move selected transactions.");
    } finally {
      setIsApplyingBulkAction(false);
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
              <select multiple value={filterAccountIds} onChange={(event) => setFilterAccountIds(Array.from(event.target.selectedOptions, (option) => option.value))}>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("transactions.filterByCategory")}
              <select
                multiple
                value={filterCategoryIds}
                onChange={(event) => setFilterCategoryIds(Array.from(event.target.selectedOptions, (option) => option.value))}
                disabled={filterType === "Transfer"}
              >
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
            <label>
              Min amount
              <input value={minAmount} onChange={(event) => setMinAmount(event.target.value)} type="number" step="0.01" />
            </label>
            <label>
              Max amount
              <input value={maxAmount} onChange={(event) => setMaxAmount(event.target.value)} type="number" step="0.01" />
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
          <div className="review-toolbar" aria-label="Export actions">
            <div className="review-toolbar-actions">
              <button className="ghost-button compact-button" type="button" onClick={exportFilteredTransactions} disabled={visibleTransactions.length === 0}>
                Export filtered CSV
              </button>
              <button className="ghost-button compact-button" type="button" onClick={exportCategoriesAndBudgets} disabled={categories.length === 0}>
                Export categories &amp; budget
              </button>
            </div>
          </div>

          {showUncategorizedOnly ? (
            <p className="workflow-banner">
              {t("transactions.workflowBanner", { count: uncategorizedExpenseCount })}
            </p>
          ) : null}
          {visibleTransactions.length > 0 ? (
            <div className="review-toolbar" aria-label="Bulk transaction actions">
              <div className="review-toolbar-actions">
                <label className="inline-checkbox">
                  <input type="checkbox" checked={allVisibleSelected} onChange={(event) => toggleSelectAllVisible(event.target.checked)} />
                  Select all in current filtered view
                </label>
                <strong>{selectedTransactionIds.length} selected</strong>
              </div>
              <div className="bulk-category-actions">
                <button className="ghost-button compact-button danger-button" type="button" onClick={() => void bulkDeleteTransactions()} disabled={selectedTransactionIds.length === 0 || isApplyingBulkAction}>Bulk delete</button>
                <label>
                  Bulk category
                  <select value={bulkCategoryId} onChange={(event) => setBulkCategoryId(event.target.value)} disabled={!bulkCategoryKind}>
                    <option value="">{t("common.chooseCategory")}</option>
                    {bulkCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </label>
                <button className="ghost-button compact-button" type="button" onClick={() => void bulkAssignCategory()} disabled={selectedCategorisableTransactions.length === 0 || !bulkCategoryKind || !bulkCategoryId || isApplyingBulkAction}>Apply category</button>
                <label>
                  Move to account
                  <select value={bulkAccountId} onChange={(event) => setBulkAccountId(event.target.value)}>
                    <option value="">{t("common.selectAccount")}</option>
                    {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                  </select>
                </label>
                <button className="ghost-button compact-button" type="button" onClick={() => void bulkMoveAccount()} disabled={selectedTransactionIds.length === 0 || !bulkAccountId || isApplyingBulkAction}>Move transactions</button>
              </div>
            </div>
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
                  <article className="table-row transaction-row" key={transaction.id} aria-label={t("transactions.rowLabel", { label })}>
                    <label className="inline-checkbox">
                      <input type="checkbox" checked={selectedTransactionIds.includes(transaction.id)} onChange={(event) => toggleTransactionSelection(transaction.id, event.target.checked)} aria-label={`Select ${label}`} />
                    </label>
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
