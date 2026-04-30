import { useEffect, useState } from "react";
import { apiClient } from "../api/client";
import { useAuth } from "../state/AuthContext";
import type { Account, AiSettings, BudgetSummary, Category, DashboardSummary, ImportRule, Profile, Transaction } from "../types";

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

export function useLedgerraData() {
  const { auth } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [aiSettings, setAiSettings] = useState<AiSettings | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [importRules, setImportRules] = useState<ImportRule[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budget, setBudget] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (!auth?.accessToken) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const month = currentMonthKey();
      const [
        profilePayload,
        aiSettingsPayload,
        dashboardPayload,
        accountsPayload,
        categoriesPayload,
        transactionsPayload,
        budgetPayload,
        importRulesPayload
      ] = await Promise.all([
        apiClient.getProfile(auth.accessToken),
        apiClient.getAiSettings(auth.accessToken),
        apiClient.getDashboard(auth.accessToken, month),
        apiClient.getAccounts(auth.accessToken),
        apiClient.getCategories(auth.accessToken),
        apiClient.getTransactions(auth.accessToken),
        apiClient.getBudget(auth.accessToken, Number(month.slice(0, 4)), Number(month.slice(5, 7))),
        apiClient.getImportRules(auth.accessToken).catch(() => [])
      ]);

      setProfile(profilePayload);
      setAiSettings(aiSettingsPayload);
      setDashboard(dashboardPayload);
      setAccounts(accountsPayload);
      setCategories(categoriesPayload);
      setTransactions(transactionsPayload);
      setBudget(budgetPayload);
      setImportRules(importRulesPayload);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [auth?.accessToken]);

  return {
    dashboard,
    profile,
    aiSettings,
    accounts,
    categories,
    importRules,
    transactions,
    budget,
    loading,
    error,
    refresh
  };
}
