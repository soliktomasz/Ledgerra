import { useEffect, useState } from "react";
import { apiClient } from "../api/client";
import { useAuth } from "../state/AuthContext";
import { AccountForm, type AccountFormValues } from "./AccountForm";
import type { Account } from "../types";
import { normalizeCurrencyCode } from "../utils/currency";

export function AccountFormModal({
  open,
  mode,
  initialValues,
  accountId,
  onClose,
  onSaved
}: {
  open: boolean;
  mode: "create" | "edit";
  initialValues: AccountFormValues;
  accountId?: string;
  onClose: () => void;
  onSaved: (account: Account) => void;
}) {
  const { auth } = useAuth();
  const [values, setValues] = useState<AccountFormValues>(initialValues);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setValues(initialValues);
      setErrorMessage(null);
      setSubmitting(false);
    }
  }, [open, initialValues]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  if (!auth?.accessToken) return null;

  const handleSubmit = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      if (mode === "create") {
        const account = await apiClient.createAccount(auth.accessToken, {
          name: values.name,
          type: values.type,
          currencyCode: normalizeCurrencyCode(values.currencyCode),
          openingBalance: Number(values.openingBalance) || 0,
          institutionName: values.institutionName || null,
          accountNumberMasked: values.accountNumberMasked || null,
          iconKind: values.iconKind
        });
        onSaved(account);
        onClose();
      } else {
        if (!accountId) {
          setErrorMessage("Missing account id");
          return;
        }
        const account = await apiClient.updateAccount(auth.accessToken, {
          id: accountId,
          name: values.name,
          type: values.type,
          currencyCode: normalizeCurrencyCode(values.currencyCode),
          openingBalance: Number(values.openingBalance) || 0,
          // currentBalance is recomputed server-side; placeholder satisfies the payload shape.
          currentBalance: 0,
          isActive: values.isActive ?? true,
          institutionName: values.institutionName || null,
          accountNumberMasked: values.accountNumberMasked || null,
          iconKind: values.iconKind
        });
        onSaved(account);
        onClose();
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <AccountForm
          mode={mode}
          values={values}
          errorMessage={errorMessage}
          submitting={submitting}
          onChange={setValues}
          onSubmit={handleSubmit}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}
