import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiClient } from "../api/client";
import type { Account, Category, Transaction } from "../types";

const transactionTypes = ["Expense", "Income", "Transfer"];
const createNewCategoryValue = "__create_new__";
const defaultCategoryColor = "#5f8f7b";

export type TransactionFormMode = "create" | "edit";

export type TransactionFormValues = {
  type: string;
  accountId: string;
  destinationAccountId: string;
  categoryId: string;
  amount: string;
  occurredOnUtc: string;
  note: string;
};

type TransactionFormProps = {
  token: string;
  accounts: Account[];
  categories: Category[];
  mode: TransactionFormMode;
  transactionId?: string | null;
  initialValues?: Partial<TransactionFormValues>;
  submitLabel?: string;
  onCancel?: () => void;
  onSaved: (transaction: Transaction) => Promise<void> | void;
  onError?: (message: string) => void;
  onStatus?: (message: string) => void;
};

export function toDateTimeLocal(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 16);
  }

  return date.toISOString().slice(0, 16);
}

export function toFormType(type: string) {
  return type.startsWith("Transfer") ? "Transfer" : type;
}

function buildDefaultValues(): TransactionFormValues {
  return {
    type: "Expense",
    accountId: "",
    destinationAccountId: "",
    categoryId: "",
    amount: "0",
    occurredOnUtc: new Date().toISOString().slice(0, 16),
    note: ""
  };
}

function getErrorMessage(caughtError: unknown, fallback: string) {
  return caughtError instanceof Error ? caughtError.message : fallback;
}

export function TransactionForm({
  token,
  accounts,
  categories,
  mode,
  transactionId,
  initialValues,
  submitLabel,
  onCancel,
  onSaved,
  onError,
  onStatus
}: TransactionFormProps) {
  const [values, setValues] = useState<TransactionFormValues>(() => ({ ...buildDefaultValues(), ...initialValues }));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState(defaultCategoryColor);

  useEffect(() => {
    setValues({ ...buildDefaultValues(), ...initialValues });
    setNewCategoryName("");
    setNewCategoryColor(defaultCategoryColor);
  }, [initialValues]);

  const filteredCategories = useMemo(() => {
    if (values.type === "Income") {
      return categories.filter((category) => category.kind === "Income");
    }

    if (values.type === "Transfer") {
      return [];
    }

    return categories.filter((category) => category.kind === "Expense");
  }, [categories, values.type]);

  const isCreatingCategory = values.categoryId === createNewCategoryValue && values.type !== "Transfer";

  const updateValue = (key: keyof TransactionFormValues, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const resetForm = () => {
    setValues(buildDefaultValues());
    setNewCategoryName("");
    setNewCategoryColor(defaultCategoryColor);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!values.accountId || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    onError?.("");
    onStatus?.("");

    try {
      let nextCategoryId = values.categoryId || undefined;

      if (isCreatingCategory) {
        const createdCategory = await apiClient.createCategory(token, {
          name: newCategoryName.trim(),
          kind: values.type,
          color: newCategoryColor
        });
        nextCategoryId = createdCategory.id;
      }

      const payload = {
        categoryId: values.type === "Transfer" ? undefined : nextCategoryId,
        destinationAccountId: values.type === "Transfer" ? values.destinationAccountId : undefined,
        amount: Number(values.amount),
        type: values.type,
        occurredOnUtc: new Date(values.occurredOnUtc).toISOString(),
        note: values.note.trim() || undefined
      };

      const savedTransaction =
        mode === "edit" && transactionId
          ? await apiClient.updateTransaction(token, transactionId, payload)
          : await apiClient.createTransaction(token, {
              accountId: values.accountId,
              ...payload
            });

      onStatus?.(mode === "edit" ? "Transaction updated." : "Transaction saved.");
      if (mode === "create") {
        resetForm();
      }
      await onSaved(savedTransaction);
    } catch (caughtError) {
      onError?.(getErrorMessage(caughtError, "Unable to save transaction."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="stack-form" onSubmit={handleSubmit}>
      <label>
        Type
        <select
          value={values.type}
          onChange={(event) => {
            updateValue("type", event.target.value);
            updateValue("categoryId", "");
            updateValue("destinationAccountId", "");
            setNewCategoryName("");
            setNewCategoryColor(defaultCategoryColor);
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
        <select value={values.accountId} onChange={(event) => updateValue("accountId", event.target.value)} required disabled={mode === "edit"}>
          <option value="">Select account</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </label>

      {values.type === "Transfer" ? (
        <label>
          Destination account
          <select value={values.destinationAccountId} onChange={(event) => updateValue("destinationAccountId", event.target.value)} required>
            <option value="">Select destination</option>
            {accounts
              .filter((account) => account.id !== values.accountId)
              .map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
          </select>
        </label>
      ) : (
        <>
          <label>
            Category
            <select value={values.categoryId} onChange={(event) => updateValue("categoryId", event.target.value)}>
              <option value="">Select category</option>
              {filteredCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
              <option value={createNewCategoryValue}>Create new category</option>
            </select>
          </label>
          {isCreatingCategory ? (
            <div className="inline-category-form">
              <label>
                New category name
                <input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} required />
              </label>
              <label>
                New category color
                <input value={newCategoryColor} onChange={(event) => setNewCategoryColor(event.target.value)} type="color" />
              </label>
            </div>
          ) : null}
        </>
      )}

      <label>
        Amount
        <input value={values.amount} onChange={(event) => updateValue("amount", event.target.value)} type="number" step="0.01" required />
      </label>
      <label>
        Date and time
        <input value={values.occurredOnUtc} onChange={(event) => updateValue("occurredOnUtc", event.target.value)} type="datetime-local" required />
      </label>
      <label>
        Note
        <textarea value={values.note} onChange={(event) => updateValue("note", event.target.value)} rows={3} />
      </label>
      <div className="transaction-form-actions">
        <button className="primary-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : submitLabel ?? (mode === "edit" ? "Save changes" : "Save transaction")}
        </button>
        {onCancel ? (
          <button className="ghost-button" type="button" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
