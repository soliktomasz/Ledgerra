import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiClient } from "../api/client";
import { useLedgerraData } from "../hooks/useLedgerraData";
import { useAuth } from "../state/AuthContext";
import { useI18n } from "../state/I18nContext";
import type { ImportRule } from "../types";
import { PageHeader } from "../ui/PageHeader";
import { SectionCard } from "../ui/SectionCard";
import { normalizeCurrencyCode, supportedCurrencies } from "../utils/currency";
import { normalizeLanguageCode, supportedLanguages } from "../utils/language";

function getErrorMessage(exception: unknown, fallback: string) {
  return exception instanceof Error ? exception.message : fallback;
}

export function SettingsPage() {
  const { auth } = useAuth();
  const { setLanguageCode, t } = useI18n();
  const { profile, aiSettings, categories, importRules, refresh } = useLedgerraData();
  const [preferredCurrencyCode, setPreferredCurrencyCode] = useState("USD");
  const [preferredLanguageCode, setPreferredLanguageCode] = useState("en");
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
    setPreferredLanguageCode(normalizeLanguageCode(profile?.preferredLanguageCode ?? "en").split("-")[0] ?? "en");
  }, [profile?.preferredLanguageCode]);

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

    await apiClient.updateProfile(
      auth.accessToken,
      normalizeCurrencyCode(preferredCurrencyCode),
      normalizeLanguageCode(preferredLanguageCode)
    );
    setLanguageCode(preferredLanguageCode);
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
      setAiProviderError(exception instanceof Error ? exception.message : t("settings.unableToSaveAiSettings"));
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
        setRuleError(t("settings.ruleFieldsRequired"));
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
      setRuleError(getErrorMessage(exception, t("settings.unableToSaveRule")));
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
      setRuleError(getErrorMessage(exception, t("settings.unableToUpdateRule")));
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
      setRuleError(getErrorMessage(exception, t("settings.unableToDeleteRule")));
    }
  };

  const isOpenAiConfigured = !!aiSettings?.providers.openAi.maskedKey;
  const isAnthropicConfigured = !!aiSettings?.providers.anthropic.maskedKey;
  const categoryNamesById = new Map(categories.map((category) => [category.id, category.name]));

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={t("settings.eyebrow")}
        title={t("settings.title")}
        description={t("settings.description")}
      />

      <SectionCard title={t("settings.regionalPreferences")}>
        <form className="stack-form" onSubmit={handleSubmit}>
          <label>
            {t("settings.preferredCurrency")}
            <select value={preferredCurrencyCode} onChange={(event) => setPreferredCurrencyCode(event.target.value)}>
              {supportedCurrencies.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("settings.preferredLanguage")}
            <select value={preferredLanguageCode} onChange={(event) => setPreferredLanguageCode(event.target.value)}>
              {supportedLanguages.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.label}
                </option>
              ))}
            </select>
          </label>
          <button className="primary-button" type="submit">
            {t("settings.savePreferences")}
          </button>
        </form>
      </SectionCard>

      <SectionCard title={t("settings.aiProviders")}>
        <form className="stack-form" onSubmit={handleAiProviderSubmit}>
          {aiProviderError ? <p className="error-banner">{aiProviderError}</p> : null}
          <label>
            {t("settings.defaultProvider")}
            <select value={defaultProvider} onChange={(event) => setDefaultProvider(event.target.value)}>
              <option value="OpenAi">OpenAI</option>
              <option value="Anthropic">Anthropic</option>
            </select>
          </label>
          <label>
            {t("settings.openAiApiKey")}
            <input
              value={openAiKey}
              onChange={(event) => setOpenAiKey(event.target.value)}
              type="password"
              placeholder={aiSettings?.providers.openAi.maskedKey ?? t("common.notConfigured")}
            />
          </label>
          <label>
            {t("settings.anthropicApiKey")}
            <input
              value={anthropicKey}
              onChange={(event) => setAnthropicKey(event.target.value)}
              type="password"
              placeholder={aiSettings?.providers.anthropic.maskedKey ?? t("common.notConfigured")}
            />
          </label>
          <button className="primary-button" type="submit">
            {t("settings.saveAiSettings")}
          </button>
        </form>
        <div className="table-list compact-list">
          <article className="table-row">
            <div>
              <strong>OpenAI</strong>
              <p>{aiSettings?.providers.openAi.isConfigured ? t("common.configured") : t("common.notConfigured")}</p>
            </div>
            <div className="settings-provider-actions">
              <strong>{aiSettings?.providers.openAi.maskedKey ?? t("common.notConfigured")}</strong>
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
                {t("common.remove")}
              </button>
            </div>
          </article>
          <article className="table-row">
            <div>
              <strong>Anthropic</strong>
              <p>{aiSettings?.providers.anthropic.isConfigured ? t("common.configured") : t("common.notConfigured")}</p>
            </div>
            <div className="settings-provider-actions">
              <strong>{aiSettings?.providers.anthropic.maskedKey ?? t("common.notConfigured")}</strong>
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
                {t("common.remove")}
              </button>
            </div>
          </article>
        </div>
      </SectionCard>

      <SectionCard title={t("settings.importRules")}>
        <form className="stack-form rule-form" onSubmit={handleRuleSubmit}>
          {ruleError ? <p className="error-banner">{ruleError}</p> : null}
          <label>
            {t("settings.ruleName")}
            <input value={ruleName} onChange={(event) => setRuleName(event.target.value)} placeholder={t("settings.ruleNamePlaceholder")} required />
          </label>
          <label>
            {t("settings.matchText")}
            <input value={ruleMatchValue} onChange={(event) => setRuleMatchValue(event.target.value)} placeholder={t("settings.matchTextPlaceholder")} required />
          </label>
          <label>
            {t("settings.transactionType")}
            <select value={transactionType} onChange={(event) => setTransactionType(event.target.value)}>
              <option value="Expense">{t("transactionType.Expense")}</option>
              <option value="Income">{t("transactionType.Income")}</option>
            </select>
          </label>
          <label>
            {t("settings.category")}
            <select value={ruleCategoryId} onChange={(event) => setRuleCategoryId(event.target.value)} disabled={filteredCategories.length === 0}>
              {filteredCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <button className="primary-button" type="submit" disabled={filteredCategories.length === 0}>
            {t("settings.addRule")}
          </button>
        </form>
        <div className="table-list compact-list rule-list">
          {importRules.length === 0 ? (
            <p className="empty-state">{t("settings.noRules")}</p>
          ) : (
            importRules.map((rule) => (
              <article className="table-row rule-row" key={rule.id}>
                <div>
                  <strong>{rule.name}</strong>
                  <p>
                    {rule.matchField} {rule.matchOperator.toLowerCase()} "{rule.matchValue}" -&gt;{" "}
                    {categoryNamesById.get(rule.assignCategoryId) ?? t("settings.unknownCategory")}
                  </p>
                </div>
                <div className="rule-actions">
                  <strong>{rule.isActive ? t("common.active") : t("common.disabled")}</strong>
                  <button className="ghost-button" type="button" aria-label={`${rule.isActive ? t("common.disable") : t("common.enable")} ${rule.name}`} onClick={() => void handleToggleRule(rule)}>
                    {rule.isActive ? t("common.disable") : t("common.enable")}
                  </button>
                  <button className="ghost-button danger-button" type="button" aria-label={`${t("common.delete")} ${rule.name}`} onClick={() => void handleDeleteRule(rule.id)}>
                    {t("common.delete")}
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </SectionCard>

      <SectionCard title={t("settings.currentSession")}>
        <div className="table-list">
          <article className="table-row">
            <div>
              <strong>{t("settings.userEmail")}</strong>
              <p>{t("settings.activeLocalAccount")}</p>
            </div>
            <strong>{profile?.email ?? auth?.email ?? t("common.unknown")}</strong>
          </article>
          <article className="table-row">
            <div>
              <strong>{t("settings.mainCurrency")}</strong>
              <p>{t("settings.appWideTotals")}</p>
            </div>
            <strong>{profile?.preferredCurrencyCode ?? "USD"}</strong>
          </article>
          <article className="table-row">
            <div>
              <strong>{t("settings.preferredLanguage")}</strong>
              <p>{t("settings.languageAndFormatting")}</p>
            </div>
            <strong>{supportedLanguages.find((language) => language.code === (profile?.preferredLanguageCode ?? preferredLanguageCode))?.label ?? preferredLanguageCode.toUpperCase()}</strong>
          </article>
          <article className="table-row">
            <div>
              <strong>{t("settings.apiModel")}</strong>
              <p>{t("settings.singleUserJwt")}</p>
            </div>
            <strong>{t("settings.v1Ready")}</strong>
          </article>
          <article className="table-row">
            <div>
              <strong>{t("settings.mobileReadiness")}</strong>
              <p>{t("settings.mobileReadinessDescription")}</p>
            </div>
            <strong>{t("settings.prepared")}</strong>
          </article>
        </div>
      </SectionCard>
    </div>
  );
}
