import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../api/client";
import { useAuth } from "../state/AuthContext";
import { useI18n } from "../state/I18nContext";
import type { Account, ReportingOverview, ReportingRangePreset } from "../types";

export function useReportingOverview() {
  const { auth } = useAuth();
  const { t } = useI18n();
  const [overview, setOverview] = useState<ReportingOverview | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rangePreset, setRangePreset] = useState<ReportingRangePreset>("12M");
  const [accountId, setAccountId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!auth?.accessToken) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [overviewPayload, accountsPayload] = await Promise.all([
        apiClient.getReportingOverview(auth.accessToken, {
          rangePreset,
          accountId: accountId || undefined
        }),
        apiClient.getAccounts(auth.accessToken)
      ]);

      setOverview(overviewPayload);
      setAccounts(accountsPayload);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : t("common.unknown"));
    } finally {
      setLoading(false);
    }
  }, [accountId, auth?.accessToken, rangePreset, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    overview,
    accounts,
    rangePreset,
    accountId,
    loading,
    error,
    setRangePreset,
    setAccountId,
    refresh
  };
}
