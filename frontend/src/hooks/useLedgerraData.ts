import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "../api/client";
import { useAuth } from "../state/AuthContext";
import { useI18n } from "../state/I18nContext";
import { useMonthSelection } from "../state/MonthContext";
import type { Account, AiSettings, BudgetSummary, Category, DashboardSummary, ExchangeRate, ImportRule, Profile, Transaction } from "../types";

type LedgerraDataOptions = {
  profile?: boolean;
  aiSettings?: boolean;
  dashboard?: boolean;
  accounts?: boolean;
  categories?: boolean;
  transactions?: boolean;
  budget?: boolean;
  importRules?: boolean;
  exchangeRates?: boolean;
};

export function useLedgerraData(options: LedgerraDataOptions = {}) {
  const { auth } = useAuth();
  const { setLanguageCode, t } = useI18n();
  const { selectedMonth, selectedYear, selectedMonthNumber } = useMonthSelection();
  const loadAll = Object.keys(options).length === 0;
  const loadProfile = options.profile ?? loadAll;
  const loadAiSettings = options.aiSettings ?? loadAll;
  const loadDashboard = options.dashboard ?? loadAll;
  const loadAccounts = options.accounts ?? loadAll;
  const loadCategories = options.categories ?? loadAll;
  const loadTransactions = options.transactions ?? loadAll;
  const loadBudget = options.budget ?? loadAll;
  const loadImportRules = options.importRules ?? loadAll;
  const loadExchangeRates = options.exchangeRates ?? loadAll;
  const translatorRef = useRef(t);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [aiSettings, setAiSettings] = useState<AiSettings | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [importRules, setImportRules] = useState<ImportRule[]>([]);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budget, setBudget] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    translatorRef.current = t;
  }, [t]);

  const refresh = useCallback(async () => {
    if (!auth?.accessToken) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [
        profilePayload,
        aiSettingsPayload,
        dashboardPayload,
        accountsPayload,
        categoriesPayload,
        transactionsPayload,
        budgetPayload,
        importRulesPayload,
        exchangeRatesPayload
      ] = await Promise.all([
        loadProfile ? apiClient.getProfile(auth.accessToken) : Promise.resolve(null),
        loadAiSettings ? apiClient.getAiSettings(auth.accessToken) : Promise.resolve(null),
        loadDashboard ? apiClient.getDashboard(auth.accessToken, selectedMonth) : Promise.resolve(null),
        loadAccounts ? apiClient.getAccounts(auth.accessToken) : Promise.resolve([]),
        loadCategories ? apiClient.getCategories(auth.accessToken) : Promise.resolve([]),
        loadTransactions ? apiClient.getTransactions(auth.accessToken) : Promise.resolve([]),
        loadBudget ? apiClient.getBudget(auth.accessToken, selectedYear, selectedMonthNumber) : Promise.resolve(null),
        loadImportRules ? apiClient.getImportRules(auth.accessToken).catch(() => []) : Promise.resolve([]),
        loadExchangeRates ? apiClient.getExchangeRates(auth.accessToken).catch(() => []) : Promise.resolve([])
      ]);

      if (loadProfile) setProfile(profilePayload);
      if (loadAiSettings) setAiSettings(aiSettingsPayload);
      if (loadDashboard) setDashboard(dashboardPayload);
      if (loadAccounts) setAccounts(accountsPayload);
      if (loadCategories) setCategories(categoriesPayload);
      if (loadTransactions) setTransactions(transactionsPayload);
      if (loadBudget) setBudget(budgetPayload);
      if (loadImportRules) setImportRules(importRulesPayload);
      if (loadExchangeRates) setExchangeRates(exchangeRatesPayload);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : translatorRef.current("common.unknown"));
    } finally {
      setLoading(false);
    }
  }, [
    auth?.accessToken,
    loadAccounts,
    loadAiSettings,
    loadBudget,
    loadCategories,
    loadDashboard,
    loadExchangeRates,
    loadImportRules,
    loadProfile,
    loadTransactions,
    selectedMonth,
    selectedMonthNumber,
    selectedYear
  ]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (profile?.preferredLanguageCode) {
      setLanguageCode(profile.preferredLanguageCode);
    }
  }, [profile?.preferredLanguageCode, setLanguageCode]);

  return {
    selectedMonth,
    dashboard,
    profile,
    aiSettings,
    accounts,
    categories,
    importRules,
    exchangeRates,
    transactions,
    budget,
    loading,
    error,
    refresh
  };
}
