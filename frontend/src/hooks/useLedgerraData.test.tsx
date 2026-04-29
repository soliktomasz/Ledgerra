import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { useLedgerraData } from "./useLedgerraData";

const mocks = vi.hoisted(() => ({
  getProfile: vi.fn(),
  getAiSettings: vi.fn(),
  getDashboard: vi.fn(),
  getAccounts: vi.fn(),
  getCategories: vi.fn(),
  getImportRules: vi.fn(),
  getTransactions: vi.fn(),
  getBudget: vi.fn()
}));

vi.mock("../state/AuthContext", () => ({
  useAuth: () => ({ auth: { accessToken: "token" } })
}));

vi.mock("../api/client", () => ({
  apiClient: {
    getProfile: mocks.getProfile,
    getAiSettings: mocks.getAiSettings,
    getDashboard: mocks.getDashboard,
    getAccounts: mocks.getAccounts,
    getCategories: mocks.getCategories,
    getImportRules: mocks.getImportRules,
    getTransactions: mocks.getTransactions,
    getBudget: mocks.getBudget
  }
}));

describe("useLedgerraData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getProfile.mockResolvedValue({ email: "owner@ledgerra.local", preferredCurrencyCode: "USD" });
    mocks.getAiSettings.mockResolvedValue({
      providers: {
        openAi: { isConfigured: true, maskedKey: "...3456" },
        anthropic: { isConfigured: false, maskedKey: null }
      },
      defaultProvider: "OpenAi"
    });
    mocks.getDashboard.mockResolvedValue({
      income: 0,
      expenses: 0,
      net: 0,
      budgetRemaining: 0,
      topCategories: [],
      accounts: []
    });
    mocks.getAccounts.mockResolvedValue([]);
    mocks.getCategories.mockResolvedValue([{ id: "category-1", name: "Groceries", kind: "Expense", isSystem: false }]);
    mocks.getImportRules.mockResolvedValue([]);
    mocks.getTransactions.mockResolvedValue([]);
    mocks.getBudget.mockResolvedValue({ totalPlanned: 0, totalSpent: 0, totalRemaining: 0, categories: [] });
  });

  test("keeps core app data when import rule loading fails", async () => {
    mocks.getImportRules.mockRejectedValue(new Error("Import rules unavailable."));

    const { result } = renderHook(() => useLedgerraData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.profile?.email).toBe("owner@ledgerra.local");
    expect(result.current.categories).toEqual([{ id: "category-1", name: "Groceries", kind: "Expense", isSystem: false }]);
    expect(result.current.importRules).toEqual([]);
  });
});
