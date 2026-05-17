import type {
  Account,
  AiSettings,
  AuthPayload,
  BudgetSummary,
  Category,
  DashboardSummary,
  ImportRule,
  MonthlyReportAnalysis,
  MonthlyReportDraftTransaction,
  Profile,
  ReportingOverview,
  ReportingRangePreset,
  BackupArchive,
  Transaction,
  SavingsGoal,
  PersonalAccessToken,
  CreatePersonalAccessTokenResponse
} from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
};

type UnauthorizedListener = () => void;

const unauthorizedListeners = new Set<UnauthorizedListener>();

function notifyUnauthorized() {
  unauthorizedListeners.forEach((listener) => listener());
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    if (response.status === 401) {
      notifyUnauthorized();
    }

    throw new Error(await readErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function readErrorMessage(response: Response): Promise<string> {
  const fallback = `Request failed with status ${response.status}`;

  try {
    const responseBody = await response.clone().json();
    if (responseBody && typeof responseBody === "object") {
      const problem = responseBody as { title?: unknown; detail?: unknown };
      if (typeof problem.title === "string" && problem.title.trim()) {
        return problem.title;
      }

      if (typeof problem.detail === "string" && problem.detail.trim()) {
        return problem.detail;
      }
    }

    const serialized = JSON.stringify(responseBody);
    return serialized || fallback;
  } catch {
    const text = await response.text();
    return text || fallback;
  }
}

export const apiClient = {
  onUnauthorized(listener: UnauthorizedListener) {
    unauthorizedListeners.add(listener);
    return () => {
      unauthorizedListeners.delete(listener);
    };
  },
  register(email: string, password: string) {
    return request<AuthPayload>("/api/auth/register", {
      method: "POST",
      body: { email, password }
    });
  },
  login(email: string, password: string) {
    return request<AuthPayload>("/api/auth/login", {
      method: "POST",
      body: { email, password }
    });
  },
  getDashboard(token: string, month: string) {
    return request<DashboardSummary>(`/api/dashboard/summary?month=${month}`, { token });
  },
  getReportingOverview(token: string, filters: { rangePreset: ReportingRangePreset; accountId?: string }) {
    const params = new URLSearchParams({ range: filters.rangePreset });
    if (filters.accountId) {
      params.set("accountId", filters.accountId);
    }

    return request<ReportingOverview>(`/api/reports/overview?${params.toString()}`, { token });
  },
  getAccounts(token: string) {
    return request<Account[]>("/api/accounts", { token });
  },
  createAccount(
    token: string,
    payload: Pick<
      Account,
      "name" | "type" | "currencyCode" | "openingBalance" | "institutionName" | "accountNumberMasked" | "iconKind"
    >
  ) {
    return request<Account>("/api/accounts", {
      method: "POST",
      token,
      body: payload
    });
  },
  updateAccount(token: string, account: Account) {
    return request<Account>(`/api/accounts/${account.id}`, {
      method: "PUT",
      token,
      body: {
        name: account.name,
        type: account.type,
        currencyCode: account.currencyCode,
        openingBalance: account.openingBalance,
        isActive: account.isActive,
        institutionName: account.institutionName ?? null,
        accountNumberMasked: account.accountNumberMasked ?? null,
        iconKind: account.iconKind
      }
    });
  },
  getProfile(token: string) {
    return request<Profile>("/api/settings/profile", { token });
  },
  updateProfile(token: string, preferredCurrencyCode: string, preferredLanguageCode: string) {
    return request<Profile>("/api/settings/profile", {
      method: "PUT",
      token,
      body: { preferredCurrencyCode, preferredLanguageCode }
    });
  },
  getAiSettings(token: string) {
    return request<AiSettings>("/api/settings/ai", { token });
  },
  saveAiProviderKey(token: string, provider: string, apiKey: string, options: { baseUrl?: string; model?: string } = {}) {
    return request<AiSettings>(`/api/settings/ai/${provider}`, {
      method: "PUT",
      token,
      body: { apiKey, ...options }
    });
  },
  updateAiProviderModel(token: string, provider: string, model: string) {
    return request<AiSettings>(`/api/settings/ai/${provider}/model`, {
      method: "PUT",
      token,
      body: { model }
    });
  },
  getAiProviderModels(token: string, provider: string) {
    return request<{ models: string[] }>(`/api/settings/ai/${provider}/models`, { token });
  },
  removeAiProviderKey(token: string, provider: string) {
    return request<AiSettings>(`/api/settings/ai/${provider}`, {
      method: "DELETE",
      token
    });
  },
  updateDefaultAiProvider(token: string, provider: string) {
    return request<AiSettings>("/api/settings/ai/default-provider", {
      method: "PUT",
      token,
      body: { provider }
    });
  },

  getPersonalAccessTokens(token: string) {
    return request<PersonalAccessToken[]>("/api/settings/personal-access-tokens", { token });
  },
  createPersonalAccessToken(token: string, name: string) {
    return request<CreatePersonalAccessTokenResponse>("/api/settings/personal-access-tokens", {
      method: "POST",
      token,
      body: { name }
    });
  },
  revokePersonalAccessToken(token: string, id: string) {
    return request<void>(`/api/settings/personal-access-tokens/${id}`, {
      method: "DELETE",
      token
    });
  },

  getCategories(token: string) {
    return request<Category[]>("/api/categories", { token });
  },
  getImportRules(token: string) {
    return request<ImportRule[]>("/api/import-rules", { token });
  },
  createImportRule(token: string, payload: Omit<ImportRule, "id" | "createdAtUtc" | "updatedAtUtc">) {
    return request<ImportRule>("/api/import-rules", {
      method: "POST",
      token,
      body: payload
    });
  },
  updateImportRule(token: string, rule: ImportRule) {
    return request<ImportRule>(`/api/import-rules/${rule.id}`, {
      method: "PUT",
      token,
      body: {
        name: rule.name,
        matchField: rule.matchField,
        matchOperator: rule.matchOperator,
        matchValue: rule.matchValue,
        assignCategoryId: rule.assignCategoryId,
        assignTransactionType: rule.assignTransactionType,
        priority: rule.priority,
        isActive: rule.isActive
      }
    });
  },
  deleteImportRule(token: string, ruleId: string) {
    return request<void>(`/api/import-rules/${ruleId}`, {
      method: "DELETE",
      token
    });
  },
  createCategory(token: string, payload: Pick<Category, "name" | "kind" | "color">) {
    return request<Category>("/api/categories", {
      method: "POST",
      token,
      body: payload
    });
  },
  updateCategory(token: string, category: Pick<Category, "id" | "name" | "kind" | "color" | "isSystem">) {
    return request<Category>(`/api/categories/${category.id}`, {
      method: "PUT",
      token,
      body: {
        name: category.name,
        kind: category.kind,
        color: category.color,
        isSystem: category.isSystem
      }
    });
  },
  deleteCategory(token: string, categoryId: string) {
    return request<void>(`/api/categories/${categoryId}`, {
      method: "DELETE",
      token
    });
  },

  getSavingsGoals(token: string) {
    return request<SavingsGoal[]>("/api/savings-goals", { token });
  },
  createSavingsGoal(token: string, payload: { name: string; targetAmount: number; deadlineUtc?: string | null }) {
    return request<SavingsGoal>("/api/savings-goals", { method: "POST", token, body: payload });
  },
  updateSavingsGoal(token: string, goalId: string, payload: { name: string; targetAmount: number; deadlineUtc?: string | null }) {
    return request<SavingsGoal>(`/api/savings-goals/${goalId}`, { method: "PUT", token, body: payload });
  },

  getTransactions(token: string, query = "") {
    return request<Transaction[]>(`/api/transactions${query}`, { token });
  },
  createTransaction(
    token: string,
    payload: {
      accountId: string;
      categoryId?: string;
      destinationAccountId?: string;
      amount: number;
      type: string;
      occurredOnUtc: string;
      note?: string;
    }
  ) {
    return request<Transaction>("/api/transactions", {
      method: "POST",
      token,
      body: payload
    });
  },
  updateTransaction(
    token: string,
    transactionId: string,
    payload: {
      categoryId?: string;
      destinationAccountId?: string;
      amount: number;
      type: string;
      occurredOnUtc: string;
      note?: string;
    }
  ) {
    return request<Transaction>(`/api/transactions/${transactionId}`, {
      method: "PUT",
      token,
      body: payload
    });
  },
  deleteTransaction(token: string, transactionId: string) {
    return request<void>(`/api/transactions/${transactionId}`, {
      method: "DELETE",
      token
    });
  },
  moveTransactionAccount(token: string, transactionId: string, destinationAccountId: string) {
    return request<Transaction>(`/api/transactions/${transactionId}/move-account`, {
      method: "POST",
      token,
      body: { destinationAccountId }
    });
  },
  analyzeMonthlyReport(token: string, payload: { accountId: string; month: string; provider: string; file: File }) {
    const body = new FormData();
    body.append("accountId", payload.accountId);
    body.append("month", payload.month);
    body.append("provider", payload.provider);
    body.append("file", payload.file);

    return fetch(`${API_BASE_URL}/api/imports/monthly-report/analyze`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body
    }).then(async (response) => {
      if (!response.ok) {
        if (response.status === 401) {
          notifyUnauthorized();
        }

        throw new Error(await readErrorMessage(response));
      }

      return response.json() as Promise<MonthlyReportAnalysis>;
    });
  },
  commitMonthlyReportDrafts(token: string, transactions: MonthlyReportDraftTransaction[], acceptedDuplicateSourceIds: string[] = []) {
    return request<{ created: Transaction[] }>("/api/imports/monthly-report/commit", {
      method: "POST",
      token,
      body: { transactions, acceptedDuplicateSourceIds }
    });
  },
  getBudget(token: string, year: number, month: number) {
    return request<BudgetSummary>(`/api/budgets/${year}/${month}`, { token });
  },
  updateBudget(
    token: string,
    year: number,
    month: number,
    categoryLimits: Array<{ categoryId: string; plannedAmount: number; carryOverUnspent: boolean }>
  ) {
    return request<BudgetSummary>(`/api/budgets/${year}/${month}`, {
      method: "PUT",
      token,
      body: { categoryLimits }
    });
  },
  exportBackup(token: string) {
    return request<BackupArchive>("/api/backup/export", { token });
  },
  restoreBackup(token: string, archive: BackupArchive) {
    return request<void>("/api/backup/restore", {
      method: "POST",
      token,
      body: archive
    });
  }
};
