import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { apiClient } from "../api/client";
import { useLedgerraData } from "../hooks/useLedgerraData";
import { useAuth } from "../state/AuthContext";
import { useI18n } from "../state/I18nContext";
import { accentPresets, useTheme, type AccentColor, type ThemePreference } from "../state/ThemeContext";
import type { ImportRule } from "../types";
import { AccountsIcon, CashFlowIcon, CategoryIcon, ImportsIcon, ReportsIcon, SettingsIcon } from "../ui/icons";
import { SectionCard } from "../ui/SectionCard";
import { normalizeCurrencyCode, supportedCurrencies } from "../utils/currency";
import { normalizeLanguageCode, supportedLanguages } from "../utils/language";

type SettingsSection = "appearance" | "region" | "session" | "ai" | "rules" | "backup";

function getErrorMessage(exception: unknown, fallback: string) {
  return exception instanceof Error ? exception.message : fallback;
}

export function SettingsPage() {
  const { auth } = useAuth();
  const { setLanguageCode, t } = useI18n();
  const { themePreference, resolvedTheme, accentColor, setThemePreference, setAccentColor } = useTheme();
  const [activeSection, setActiveSection] = useState<SettingsSection>("appearance");
  const { profile, aiSettings, categories, importRules, refresh } = useLedgerraData({
    profile: true,
    aiSettings: true,
    categories: true,
    importRules: true
  });
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
  const [backupError, setBackupError] = useState<string | null>(null);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);

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
  const configuredAiProviderCount = Number(isOpenAiConfigured) + Number(isAnthropicConfigured);
  const settingsGroups = [
    {
      label: t("settings.applicationGroup"),
      items: [
        { section: "appearance" as SettingsSection, label: t("settings.navAppearance"), icon: SettingsIcon },
        { section: "region" as SettingsSection, label: t("settings.navRegion"), icon: CashFlowIcon },
        { section: "session" as SettingsSection, label: t("settings.navSession"), icon: AccountsIcon }
      ]
    },
    {
      label: t("settings.dataGroup"),
      items: [
        { section: "ai" as SettingsSection, label: t("settings.navAi"), icon: ReportsIcon, badge: configuredAiProviderCount },
        { section: "rules" as SettingsSection, label: t("settings.navRules"), icon: CategoryIcon, badge: importRules.length },
        { section: "backup" as SettingsSection, label: t("settings.navBackup"), icon: ImportsIcon }
      ]
    },
    {
      label: t("settings.accountGroup"),
      items: [
        { section: "session" as SettingsSection, label: t("settings.profile"), icon: AccountsIcon },
        { section: "session" as SettingsSection, label: t("settings.security"), icon: SettingsIcon }
      ]
    }
  ];

  const sectionBreadcrumbs: Record<SettingsSection, string> = {
    appearance: t("settings.appearance"),
    region: t("settings.regionalPreferences"),
    session: t("settings.currentSession"),
    ai: t("settings.aiProviders"),
    rules: t("settings.importRules"),
    backup: t("settings.backupAndRestore")
  };

  const handleExportBackup = async () => {
    if (!auth?.accessToken) {
      return;
    }

    try {
      setBackupError(null);
      const archive = await apiClient.exportBackup(auth.accessToken);
      const blob = new Blob([JSON.stringify(archive, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ledgerra-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setBackupNotice(t("settings.backupExported"));
    } catch (exception) {
      setBackupError(getErrorMessage(exception, t("settings.unableToExportBackup")));
    }
  };

  const handleRestoreBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!auth?.accessToken) {
      return;
    }

    const file = event.currentTarget.files?.[0];
    if (!file) {
      return;
    }

    try {
      setBackupError(null);
      const content = await file.text();
      const archive = JSON.parse(content);

      const confirmed = window.confirm(t("settings.restoreBackupConfirm"));

      if (!confirmed) {
        return;
      }

      await apiClient.restoreBackup(auth.accessToken, archive);
      await refresh();
      setBackupNotice(t("settings.backupRestored"));
    } catch (exception) {
      setBackupError(getErrorMessage(exception, t("settings.unableToRestoreBackup")));
    } finally {
      event.currentTarget.value = "";
    }
  };

  return (
    <div className="settings-page">
      <header className="settings-hero">
        <div>
          <div className="settings-breadcrumb">
            <span>Ledgerra</span>
            <span>/</span>
            <span>{t("settings.eyebrow")}</span>
            <span>/</span>
            <strong>{sectionBreadcrumbs[activeSection]}</strong>
          </div>
          <h1>{t("settings.title")}</h1>
          <p>{t("settings.description")}</p>
        </div>
        <div className="settings-search" aria-hidden="true">
          <span>⌕</span>
          <span>{t("settings.searchPlaceholder")}</span>
          <kbd>⌘K</kbd>
        </div>
      </header>

      <div className="settings-workspace-grid">
        <aside className="settings-subnav" aria-label={t("settings.sections")}>
          {settingsGroups.map((group) => (
            <div className="settings-subnav-group" key={group.label}>
              <span>{group.label}</span>
              {group.items.map((item) => (
                <button
                  type="button"
                  className={`settings-subnav-link${activeSection === item.section ? " active" : ""}`}
                  key={`${group.label}-${item.label}`}
                  onClick={() => setActiveSection(item.section)}
                >
                  <item.icon />
                  <span>{item.label}</span>
                  {typeof item.badge === "number" ? <strong>{item.badge}</strong> : null}
                </button>
              ))}
            </div>
          ))}
        </aside>

        <div className="settings-main-panels">
          {activeSection === "appearance" && (
            <SectionCard title={t("settings.appearance")} icon={<SettingsIcon />}>
              <form className="stack-form settings-compact-form" onSubmit={(event) => event.preventDefault()}>
                <label>
                  {t("settings.theme")}
                  <select
                    value={themePreference}
                    onChange={(event) => setThemePreference(event.target.value as ThemePreference)}
                  >
                    <option value="system">{t("settings.themeSystem")}</option>
                    <option value="light">{t("settings.themeLight")}</option>
                    <option value="dark">{t("settings.themeDark")}</option>
                  </select>
                </label>
                <p className="helper-text">
                  {t("settings.themeDescription", {
                    theme: resolvedTheme === "dark" ? t("settings.themeDark").toLowerCase() : t("settings.themeLight").toLowerCase()
                  })}
                </p>
                <div className="settings-choice-stack">
                  <span>{t("settings.accent")}</span>
                  <div className="settings-swatch-row">
                    {accentPresets.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        className={`settings-swatch${accentColor === preset.id ? " active" : ""}`}
                        style={{ background: preset.swatch }}
                        aria-label={preset.id}
                        onClick={() => setAccentColor(preset.id)}
                      />
                    ))}
                  </div>
                </div>
              </form>
            </SectionCard>
          )}

          {activeSection === "region" && (
            <SectionCard title={t("settings.regionalPreferences")} icon={<CashFlowIcon />}>
              <form className="settings-form-grid" onSubmit={handleSubmit}>
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
          )}

          {activeSection === "ai" && (
            <SectionCard title={t("settings.aiProviders")} icon={<ReportsIcon />}>
              <div className="settings-ai-layout">
                <form className="stack-form settings-ai-form" onSubmit={handleAiProviderSubmit}>
                  {aiProviderError ? <p className="error-banner">{aiProviderError}</p> : null}
                  <label>
                    {t("settings.defaultProvider")}
                    <select value={defaultProvider} onChange={(event) => setDefaultProvider(event.target.value)}>
                      <option value="OpenAi">OpenAI</option>
                      <option value="Anthropic">Anthropic</option>
                    </select>
                  </label>
                  <div className="settings-key-grid">
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
                  </div>
                  <button className="primary-button" type="submit">
                    {t("settings.saveAiSettings")}
                  </button>
                </form>

                <div className="settings-provider-list">
                  <article className="settings-provider-row">
                    <div>
                      <strong>OpenAI</strong>
                      <p>{aiSettings?.providers.openAi.isConfigured ? t("common.configured") : t("common.notConfigured")}</p>
                    </div>
                    <div className="settings-provider-actions">
                      <strong>{aiSettings?.providers.openAi.maskedKey ?? t("common.notConfigured")}</strong>
                      <button
                        className="ghost-button compact-button"
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
                  <article className="settings-provider-row">
                    <div>
                      <strong>Anthropic</strong>
                      <p>{aiSettings?.providers.anthropic.isConfigured ? t("common.configured") : t("common.notConfigured")}</p>
                    </div>
                    <div className="settings-provider-actions">
                      <strong>{aiSettings?.providers.anthropic.maskedKey ?? t("common.notConfigured")}</strong>
                      <button
                        className="ghost-button compact-button"
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
              </div>
            </SectionCard>
          )}

          {activeSection === "rules" && (
            <SectionCard title={t("settings.importRules")} icon={<CategoryIcon />}>
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
                        <button className="ghost-button compact-button" type="button" aria-label={`${rule.isActive ? t("common.disable") : t("common.enable")} ${rule.name}`} onClick={() => void handleToggleRule(rule)}>
                          {rule.isActive ? t("common.disable") : t("common.enable")}
                        </button>
                        <button className="ghost-button compact-button danger-button" type="button" aria-label={`${t("common.delete")} ${rule.name}`} onClick={() => void handleDeleteRule(rule.id)}>
                          {t("common.delete")}
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </SectionCard>
          )}

          {activeSection === "session" && (
            <SectionCard title={t("settings.currentSession")} icon={<AccountsIcon />}>
              <div className="settings-session-grid">
                <article className="settings-fact">
                  <span>{t("settings.userEmail")}</span>
                  <strong>{profile?.email ?? auth?.email ?? t("common.unknown")}</strong>
                  <p>{t("settings.activeLocalAccount")}</p>
                </article>
                <article className="settings-fact">
                  <span>{t("settings.mainCurrency")}</span>
                  <strong>{profile?.preferredCurrencyCode ?? "USD"}</strong>
                  <p>{t("settings.appWideTotals")}</p>
                </article>
                <article className="settings-fact">
                  <span>{t("settings.preferredLanguage")}</span>
                  <strong>{supportedLanguages.find((language) => language.code === (profile?.preferredLanguageCode ?? preferredLanguageCode))?.label ?? preferredLanguageCode.toUpperCase()}</strong>
                  <p>{t("settings.languageAndFormatting")}</p>
                </article>
                <article className="settings-fact">
                  <span>{t("settings.apiModel")}</span>
                  <strong>{t("settings.v1Ready")}</strong>
                  <p>{t("settings.singleUserJwt")}</p>
                </article>
                <article className="settings-fact">
                  <span>{t("settings.mobileReadiness")}</span>
                  <strong>{t("settings.prepared")}</strong>
                  <p>{t("settings.mobileReadinessDescription")}</p>
                </article>
              </div>
            </SectionCard>
          )}

          {activeSection === "backup" && (
            <SectionCard title={t("settings.backupAndRestore")} icon={<ImportsIcon />}>
              <div className="stack-form settings-backup-panel">
                {backupError ? <p className="error-banner">{backupError}</p> : null}
                {backupNotice ? <p className="success-banner settings-inline-banner">{backupNotice}</p> : null}
                <button className="primary-button" type="button" onClick={() => void handleExportBackup()}>
                  {t("settings.exportBackup")}
                </button>
                <label>
                  {t("settings.restoreBackup")}
                  <input type="file" accept="application/json" onChange={(event) => void handleRestoreBackup(event)} />
                </label>
              </div>
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}
