import type {
  Account,
  AuthPayload,
  BudgetSummary,
  Category,
  DashboardSummary,
  Transaction
} from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
};

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
    const payload = await response.text();
    throw new Error(payload || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const apiClient = {
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
  getAccounts(token: string) {
    return request<Account[]>("/api/accounts", { token });
  },
  createAccount(token: string, payload: Pick<Account, "name" | "type" | "currencyCode" | "openingBalance">) {
    return request<Account>("/api/accounts", {
      method: "POST",
      token,
      body: payload
    });
  },
  getCategories(token: string) {
    return request<Category[]>("/api/categories", { token });
  },
  createCategory(token: string, payload: Pick<Category, "name" | "kind" | "color">) {
    return request<Category>("/api/categories", {
      method: "POST",
      token,
      body: payload
    });
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
  getBudget(token: string, year: number, month: number) {
    return request<BudgetSummary>(`/api/budgets/${year}/${month}`, { token });
  },
  updateBudget(
    token: string,
    year: number,
    month: number,
    categoryLimits: Array<{ categoryId: string; plannedAmount: number }>
  ) {
    return request<BudgetSummary>(`/api/budgets/${year}/${month}`, {
      method: "PUT",
      token,
      body: { categoryLimits }
    });
  }
};
