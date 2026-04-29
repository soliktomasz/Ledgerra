export type AuthPayload = {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresAtUtc: string;
};

export type Account = {
  id: string;
  name: string;
  type: string;
  currencyCode: string;
  openingBalance: number;
  currentBalance: number;
  isActive: boolean;
};

export type Profile = {
  email: string;
  preferredCurrencyCode: string;
};

export type AiProviderStatus = {
  isConfigured: boolean;
  maskedKey?: string | null;
};

export type AiSettings = {
  providers: {
    openAi: AiProviderStatus;
    anthropic: AiProviderStatus;
  };
  defaultProvider: string;
};

export type Category = {
  id: string;
  name: string;
  kind: string;
  color?: string | null;
  isSystem: boolean;
};

export type Transaction = {
  id: string;
  accountId: string;
  categoryId?: string | null;
  amount: number;
  type: string;
  occurredOnUtc: string;
  note?: string | null;
  transferGroupId?: string | null;
};

export type MonthlyReportDraftTransaction = {
  sourceId: string;
  accountId: string;
  categoryId?: string | null;
  amount: number;
  type: string;
  occurredOnUtc: string;
  note?: string | null;
  confidence: number;
  warnings: string[];
};

export type MonthlyReportAnalysis = {
  transactions: MonthlyReportDraftTransaction[];
  warnings: string[];
};

export type BudgetCategory = {
  categoryId: string;
  categoryName: string;
  planned: number;
  spent: number;
  remaining: number;
};

export type BudgetSummary = {
  totalPlanned: number;
  totalSpent: number;
  totalRemaining: number;
  categories: BudgetCategory[];
};

export type DashboardSummary = {
  income: number;
  expenses: number;
  net: number;
  budgetRemaining: number;
  topCategories: Array<{
    categoryId: string;
    categoryName: string;
    amount: number;
  }>;
  accounts: Array<{
    accountId: string;
    name: string;
    balance: number;
  }>;
};
