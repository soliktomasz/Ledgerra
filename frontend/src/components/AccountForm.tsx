import { FormEvent } from "react";
import { useI18n } from "../state/I18nContext";
import { supportedCurrencies } from "../utils/currency";
import type { AccountIconKind } from "../types";

const accountTypes = ["Checking", "Savings", "Cash", "Credit", "Joint", "Investment"] as const;
const accountIconKinds: AccountIconKind[] = ["Bank", "Piggy", "Card", "Cash", "Chart", "Users"];

export type AccountFormValues = {
  name: string;
  type: string;
  currencyCode: string;
  openingBalance: string;
  institutionName: string;
  accountNumberMasked: string;
  iconKind: AccountIconKind;
  isActive?: boolean;
};

type AccountFormProps = {
  mode: "create" | "edit";
  values: AccountFormValues;
  errorMessage?: string | null;
  submitting?: boolean;
  onChange: (next: AccountFormValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

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
    case "Investment":
      return "Investment";
    default:
      return type;
  }
}

export function AccountForm({
  mode,
  values,
  errorMessage,
  submitting,
  onChange,
  onSubmit,
  onCancel
}: AccountFormProps) {
  const { t } = useI18n();

  const update = <K extends keyof AccountFormValues>(key: K, value: AccountFormValues[K]) => {
    onChange({ ...values, [key]: value });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form className="stack-form account-form" onSubmit={handleSubmit}>
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

      <label>
        {t("accounts.name")}
        <input
          value={values.name}
          onChange={(event) => update("name", event.target.value)}
          required
        />
      </label>

      <label>
        {t("accounts.type")}
        <select value={values.type} onChange={(event) => update("type", event.target.value)}>
          {accountTypes.map((option) => (
            <option key={option} value={option}>
              {getAccountTypeLabel(option, t)}
            </option>
          ))}
        </select>
      </label>

      <label>
        {"Icon"}
        <select
          value={values.iconKind}
          onChange={(event) => update("iconKind", event.target.value as AccountIconKind)}
        >
          {accountIconKinds.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label>
        {t("accounts.currency")}
        <select
          value={values.currencyCode}
          onChange={(event) => update("currencyCode", event.target.value)}
        >
          {supportedCurrencies.map((currency) => (
            <option key={currency.code} value={currency.code}>
              {currency.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        {t("accounts.openingBalance")}
        <input
          value={values.openingBalance}
          onChange={(event) => update("openingBalance", event.target.value)}
          type="number"
          step="0.01"
        />
      </label>

      <label>
        {"Institution name"}
        <input
          value={values.institutionName}
          onChange={(event) => update("institutionName", event.target.value)}
        />
      </label>

      <label>
        {"Account number"}
        <input
          value={values.accountNumberMasked}
          onChange={(event) => update("accountNumberMasked", event.target.value)}
        />
      </label>

      {mode === "edit" ? (
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={values.isActive ?? true}
            onChange={(event) => update("isActive", event.target.checked)}
          />
          {"Active"}
        </label>
      ) : null}

      <div className="form-actions">
        <button className="primary-button" type="submit" disabled={submitting}>
          {mode === "edit" ? t("common.save") : t("accounts.addAccount")}
        </button>
        <button className="ghost-button" type="button" onClick={onCancel} disabled={submitting}>
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}
