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
  preferredLanguageCode: string;
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
  defaultProvider?: string | null;
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
  appliedRuleId?: string | null;
  appliedRuleName?: string | null;
  isLikelyDuplicate?: boolean;
  duplicateTransactionId?: string | null;
  duplicateReason?: string | null;
  isSelectedByDefault?: boolean;
};

export type MonthlyReportAnalysis = {
  transactions: MonthlyReportDraftTransaction[];
  warnings: string[];
};

export type ImportRule = {
  id: string;
  name: string;
  matchField: string;
  matchOperator: string;
  matchValue: string;
  assignCategoryId: string;
  assignTransactionType: string;
  priority: number;
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
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
  trends: {
    spendingDeltaAmount: number;
    spendingDeltaPercent?: number | null;
    spendingSparkline: Array<{
      month: string;
      amount: number;
    }>;
  };
};

export type ReportingRangePreset = "3M" | "6M" | "12M" | "YTD";

export type ReportingOverview = {
  rangePreset: ReportingRangePreset;
  startMonth: string;
  endMonth: string;
  currencyCode: string;
  summary: {
    incomeTotal: number;
    expenseTotal: number;
    netCashFlow: number;
    spendingDeltaAmount: number;
    spendingDeltaPercent?: number | null;
    netWorthDelta: number;
  };
  monthlySpendingTrend: Array<{
    month: string;
    amount: number;
  }>;
  incomeVsExpense: Array<{
    month: string;
    income: number;
    expenses: number;
    net: number;
  }>;
  categoryBreakdown: Array<{
    categoryId: string;
    categoryName: string;
    amount: number;
    percentage: number;
  }>;
  netWorthHistory: Array<{
    month: string;
    netWorth: number;
    currencyCode: string;
  }>;
  warnings: Array<{
    code: string;
    message: string;
  }>;
};

export type BackupArchive = {
  version: number;
  exportedAtUtc: string;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgetPeriods: Array<{
    id: string;
    year: number;
    month: number;
    categoryLimits: Array<{ id: string; categoryId: string; plannedAmount: number }>;
  }>;
};
