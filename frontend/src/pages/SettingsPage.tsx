import { FormEvent, useEffect, useState } from "react";
import { apiClient } from "../api/client";
import { useLedgerraData } from "../hooks/useLedgerraData";
import { useAuth } from "../state/AuthContext";
import { PageHeader } from "../ui/PageHeader";
import { SectionCard } from "../ui/SectionCard";
import { normalizeCurrencyCode, supportedCurrencies } from "../utils/currency";

export function SettingsPage() {
  const { auth } = useAuth();
  const { profile, refresh } = useLedgerraData();
  const [preferredCurrencyCode, setPreferredCurrencyCode] = useState("USD");

  useEffect(() => {
    setPreferredCurrencyCode(profile?.preferredCurrencyCode ?? "USD");
  }, [profile?.preferredCurrencyCode]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!auth?.accessToken) {
      return;
    }

    await apiClient.updateProfile(auth.accessToken, normalizeCurrencyCode(preferredCurrencyCode));
    await refresh();
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Settings"
        title="Workspace preferences"
        description="Set the main currency used for dashboard, budget, and reporting totals."
      />

      <SectionCard title="Main currency">
        <form className="stack-form" onSubmit={handleSubmit}>
          <label>
            Preferred currency
            <select value={preferredCurrencyCode} onChange={(event) => setPreferredCurrencyCode(event.target.value)}>
              {supportedCurrencies.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.label}
                </option>
              ))}
            </select>
          </label>
          <button className="primary-button" type="submit">
            Save currency
          </button>
        </form>
      </SectionCard>

      <SectionCard title="Current session">
        <div className="table-list">
          <article className="table-row">
            <div>
              <strong>User email</strong>
              <p>Active local account</p>
            </div>
            <strong>{profile?.email ?? auth?.email ?? "Unknown"}</strong>
          </article>
          <article className="table-row">
            <div>
              <strong>Main currency</strong>
              <p>Used for app-wide totals.</p>
            </div>
            <strong>{profile?.preferredCurrencyCode ?? "USD"}</strong>
          </article>
          <article className="table-row">
            <div>
              <strong>API model</strong>
              <p>Single-user JWT auth</p>
            </div>
            <strong>v1 ready</strong>
          </article>
          <article className="table-row">
            <div>
              <strong>Mobile readiness</strong>
              <p>Same JSON API can back future iOS/Android clients.</p>
            </div>
            <strong>Prepared</strong>
          </article>
        </div>
      </SectionCard>
    </div>
  );
}
