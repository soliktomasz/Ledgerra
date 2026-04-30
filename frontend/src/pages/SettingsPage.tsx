import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiClient } from "../api/client";
import { useLedgerraData } from "../hooks/useLedgerraData";
import { useAuth } from "../state/AuthContext";
import type { ImportRule } from "../types";
import { PageHeader } from "../ui/PageHeader";
import { SectionCard } from "../ui/SectionCard";
import { normalizeCurrencyCode, supportedCurrencies } from "../utils/currency";

function getErrorMessage(exception: unknown, fallback: string) {
  return exception instanceof Error ? exception.message : fallback;
}

export function SettingsPage() {
  const { auth } = useAuth();
  const { profile, aiSettings, categories, importRules, refresh } = useLedgerraData();
  const [preferredCurrencyCode, setPreferredCurrencyCode] = useState("USD");
  const [defaultProvider, setDefaultProvider] = useState("OpenAi");
  const [openAiKey, setOpenAiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [aiProviderError, setAiProviderError] = useState<string | null>(null);
  const [ruleName, setRuleName] = useState("");
  const [ruleMatchValue, setRuleMatchValue] = useState("");
  const [transactionType, setTransactionType] = useState("Expense");
  const [ruleCategoryId, setRuleCategoryId] = useState("");
  const [ruleError, setRuleError] = useState<string | null>(null);

  const filteredCategories = useMemo(() => categories.filter((category) => category.kind === transactionType), [categories, transactionType]);

  useEffect(() => {
    setPreferredCurrencyCode(profile?.preferredCurrencyCode ?? "USD");
  }, [profile?.preferredCurrencyCode]);

  useEffect(() => {
    setDefaultProvider(aiSettings?.defaultProvider ?? "OpenAi");
  }, [aiSettings?.defaultProvider]);

  useEffect(() => {
    if (filteredCategories.length === 0) {
      setRuleCategoryId("");
      return;
    }

    if (!filteredCategories.some((category) => category.id === ruleCategoryId)) {
      setRuleCategoryId(filteredCategories[0].id);
    }
  }, [filteredCategories, ruleCategoryId]);

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

    try {
      setAiProviderError(null);
      if (openAiKey.trim()) {
        await apiClient.saveAiProviderKey(auth.accessToken, "openai", openAiKey.trim());
      }

      if (anthropicKey.trim()) {
        await apiClient.saveAiProviderKey(auth.accessToken, "anthropic", anthropicKey.trim());
      }

      await apiClient.updateDefaultAiProvider(auth.accessToken, defaultProvider);
      await refresh();
    } catch (exception) {
      console.error(exception);
      setAiProviderError(exception instanceof Error ? exception.message : "Unable to save AI settings.");
      return;
    } finally {
      setOpenAiKey("");
      setAnthropicKey("");
    }
  };

  const handleRemoveProvider = async (provider: string) => {
    if (!auth?.accessToken) {
      return;
    }

    await apiClient.removeAiProviderKey(auth.accessToken, provider);
    await refresh();
  };

  const handleRuleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!auth?.accessToken || !ruleCategoryId) {
      return;
    }

    try {
      setRuleError(null);
      const name = ruleName.trim();
      const value = ruleMatchValue.trim();
      if (!name || !value) {
        setRuleError("Rule name and match text are required.");
        return;
      }

      await apiClient.createImportRule(auth.accessToken, {
        name,
        matchField: "Note",
        matchOperator: "Contains",
        matchValue: value,
        assignCategoryId: ruleCategoryId,
        assignTransactionType: transactionType,
        priority: 100,
        isActive: true
      });
      setRuleName("");
      setRuleMatchValue("");
      await refresh();
    } catch (exception) {
      setRuleError(getErrorMessage(exception, "Unable to save import rule."));
    }
  };

  const handleToggleRule = async (rule: ImportRule) => {
    if (!auth?.accessToken) {
      return;
    }

    try {
      setRuleError(null);
      await apiClient.updateImportRule(auth.accessToken, { ...rule, isActive: !rule.isActive });
      await refresh();
    } catch (exception) {
      setRuleError(getErrorMessage(exception, "Unable to update import rule."));
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!auth?.accessToken) {
      return;
    }

    try {
      setRuleError(null);
      await apiClient.deleteImportRule(auth.accessToken, ruleId);
      await refresh();
    } catch (exception) {
      setRuleError(getErrorMessage(exception, "Unable to delete import rule."));
    }
  };

  const isOpenAiConfigured = !!aiSettings?.providers.openAi.maskedKey;
  const isAnthropicConfigured = !!aiSettings?.providers.anthropic.maskedKey;
  const categoryNamesById = new Map(categories.map((category) => [category.id, category.name]));

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
          {aiProviderError ? <p className="error-banner">{aiProviderError}</p> : null}
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
              <button
                className="ghost-button"
                type="button"
                disabled={!isOpenAiConfigured}
                onClick={() => {
                  if (isOpenAiConfigured) {
                    handleRemoveProvider("openai");
                  }
                }}
              >
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
              <button
                className="ghost-button"
                type="button"
                disabled={!isAnthropicConfigured}
                onClick={() => {
                  if (isAnthropicConfigured) {
                    handleRemoveProvider("anthropic");
                  }
                }}
              >
                Remove
              </button>
            </div>
          </article>
        </div>
      </SectionCard>

      <SectionCard title="Import rules">
        <form className="stack-form rule-form" onSubmit={handleRuleSubmit}>
          {ruleError ? <p className="error-banner">{ruleError}</p> : null}
          <label>
            Rule name
            <input value={ruleName} onChange={(event) => setRuleName(event.target.value)} placeholder="Coffee shops" required />
          </label>
          <label>
            Match text
            <input value={ruleMatchValue} onChange={(event) => setRuleMatchValue(event.target.value)} placeholder="Cafe" required />
          </label>
          <label>
            Transaction type
            <select value={transactionType} onChange={(event) => setTransactionType(event.target.value)}>
              <option>Expense</option>
              <option>Income</option>
            </select>
          </label>
          <label>
            Category
            <select value={ruleCategoryId} onChange={(event) => setRuleCategoryId(event.target.value)} disabled={filteredCategories.length === 0}>
              {filteredCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <button className="primary-button" type="submit" disabled={filteredCategories.length === 0}>
            Add rule
          </button>
        </form>
        <div className="table-list compact-list rule-list">
          {importRules.length === 0 ? (
            <p className="empty-state">No import rules yet.</p>
          ) : (
            importRules.map((rule) => (
              <article className="table-row rule-row" key={rule.id}>
                <div>
                  <strong>{rule.name}</strong>
                  <p>
                    {rule.matchField} {rule.matchOperator.toLowerCase()} "{rule.matchValue}" -&gt;{" "}
                    {categoryNamesById.get(rule.assignCategoryId) ?? "Unknown category"}
                  </p>
                </div>
                <div className="rule-actions">
                  <strong>{rule.isActive ? "Active" : "Disabled"}</strong>
                  <button className="ghost-button" type="button" aria-label={`${rule.isActive ? "Disable" : "Enable"} ${rule.name}`} onClick={() => void handleToggleRule(rule)}>
                    {rule.isActive ? "Disable" : "Enable"}
                  </button>
                  <button className="ghost-button danger-button" type="button" aria-label={`Delete ${rule.name}`} onClick={() => void handleDeleteRule(rule.id)}>
                    Delete
                  </button>
                </div>
              </article>
            ))
          )}
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
