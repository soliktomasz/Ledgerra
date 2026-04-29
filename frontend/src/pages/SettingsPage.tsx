import { FormEvent, useEffect, useState } from "react";
import { apiClient } from "../api/client";
import { useLedgerraData } from "../hooks/useLedgerraData";
import { useAuth } from "../state/AuthContext";
import { PageHeader } from "../ui/PageHeader";
import { SectionCard } from "../ui/SectionCard";
import { normalizeCurrencyCode, supportedCurrencies } from "../utils/currency";

export function SettingsPage() {
  const { auth } = useAuth();
  const { profile, aiSettings, refresh } = useLedgerraData();
  const [preferredCurrencyCode, setPreferredCurrencyCode] = useState("USD");
  const [defaultProvider, setDefaultProvider] = useState("OpenAi");
  const [openAiKey, setOpenAiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");

  useEffect(() => {
    setPreferredCurrencyCode(profile?.preferredCurrencyCode ?? "USD");
  }, [profile?.preferredCurrencyCode]);

  useEffect(() => {
    setDefaultProvider(aiSettings?.defaultProvider ?? "OpenAi");
  }, [aiSettings?.defaultProvider]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!auth?.accessToken) {
      return;
    }

    await apiClient.updateProfile(auth.accessToken, normalizeCurrencyCode(preferredCurrencyCode));
    await refresh();
  };

  const handleAiProviderSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!auth?.accessToken) {
      return;
    }

    if (openAiKey.trim()) {
      await apiClient.saveAiProviderKey(auth.accessToken, "openai", openAiKey.trim());
    }

    if (anthropicKey.trim()) {
      await apiClient.saveAiProviderKey(auth.accessToken, "anthropic", anthropicKey.trim());
    }

    await apiClient.updateDefaultAiProvider(auth.accessToken, defaultProvider);
    setOpenAiKey("");
    setAnthropicKey("");
    await refresh();
  };

  const handleRemoveProvider = async (provider: string) => {
    if (!auth?.accessToken) {
      return;
    }

    await apiClient.removeAiProviderKey(auth.accessToken, provider);
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

      <SectionCard title="AI providers">
        <form className="stack-form" onSubmit={handleAiProviderSubmit}>
          <label>
            Default provider
            <select value={defaultProvider} onChange={(event) => setDefaultProvider(event.target.value)}>
              <option value="OpenAi">OpenAI</option>
              <option value="Anthropic">Anthropic</option>
            </select>
          </label>
          <label>
            OpenAI API key
            <input
              value={openAiKey}
              onChange={(event) => setOpenAiKey(event.target.value)}
              type="password"
              placeholder={aiSettings?.providers.openAi.maskedKey ?? "Not configured"}
            />
          </label>
          <label>
            Anthropic API key
            <input
              value={anthropicKey}
              onChange={(event) => setAnthropicKey(event.target.value)}
              type="password"
              placeholder={aiSettings?.providers.anthropic.maskedKey ?? "Not configured"}
            />
          </label>
          <button className="primary-button" type="submit">
            Save AI settings
          </button>
        </form>
        <div className="table-list compact-list">
          <article className="table-row">
            <div>
              <strong>OpenAI</strong>
              <p>{aiSettings?.providers.openAi.isConfigured ? "Configured" : "Not configured"}</p>
            </div>
            <div className="settings-provider-actions">
              <strong>{aiSettings?.providers.openAi.maskedKey ?? "Not configured"}</strong>
              <button className="ghost-button" type="button" onClick={() => handleRemoveProvider("openai")}>
                Remove
              </button>
            </div>
          </article>
          <article className="table-row">
            <div>
              <strong>Anthropic</strong>
              <p>{aiSettings?.providers.anthropic.isConfigured ? "Configured" : "Not configured"}</p>
            </div>
            <div className="settings-provider-actions">
              <strong>{aiSettings?.providers.anthropic.maskedKey ?? "Not configured"}</strong>
              <button className="ghost-button" type="button" onClick={() => handleRemoveProvider("anthropic")}>
                Remove
              </button>
            </div>
          </article>
        </div>
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
