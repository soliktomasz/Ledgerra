import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { RecurringTransactionsPage } from "./RecurringTransactionsPage";
import type { Account, Category, Profile, RecurringTransactionTemplate } from "../types";

const mocks = vi.hoisted(() => ({
  getRecurringTransactions: vi.fn(),
  createRecurringTransaction: vi.fn(),
  updateRecurringTransaction: vi.fn(),
  updateRecurringTransactionStatus: vi.fn(),
  deleteRecurringTransaction: vi.fn(),
  generateDueRecurringTransactions: vi.fn(),
  accounts: [] as Account[],
  categories: [] as Category[],
  profile: null as Profile | null
}));

vi.mock("../state/AuthContext", () => ({
  useAuth: () => ({ auth: { accessToken: "token" } })
}));

vi.mock("../api/client", () => ({
  apiClient: {
    getRecurringTransactions: mocks.getRecurringTransactions,
    createRecurringTransaction: mocks.createRecurringTransaction,
    updateRecurringTransaction: mocks.updateRecurringTransaction,
    updateRecurringTransactionStatus: mocks.updateRecurringTransactionStatus,
    deleteRecurringTransaction: mocks.deleteRecurringTransaction,
    generateDueRecurringTransactions: mocks.generateDueRecurringTransactions
  }
}));

vi.mock("../hooks/useLedgerraData", () => ({
  useLedgerraData: () => ({
    accounts: mocks.accounts,
    categories: mocks.categories,
    profile: mocks.profile,
    loading: false,
    error: null
  })
}));

describe("RecurringTransactionsPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.accounts = [
      { id: "account-1", name: "Checking", type: "Checking", currencyCode: "USD", openingBalance: 0, currentBalance: 0, isActive: true, iconKind: "Bank" }
    ];
    mocks.categories = [
      { id: "category-1", name: "Rent", kind: "Expense", isSystem: false }
    ];
    mocks.profile = { email: "owner@ledgerra.local", preferredCurrencyCode: "USD", preferredLanguageCode: "en" };
    mocks.getRecurringTransactions.mockResolvedValue([] as RecurringTransactionTemplate[]);
    mocks.createRecurringTransaction.mockResolvedValue({ id: "template-1" });
  });

  test("blocks invalid amount submissions before calling the API", async () => {
    const user = userEvent.setup();

    render(<RecurringTransactionsPage />);

    await screen.findByText("No recurring templates yet. Create one to automate scheduled income or expenses.");
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "" } });
    await user.click(screen.getByRole("button", { name: "Create template" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Enter a valid amount.");
    await waitFor(() => {
      expect(mocks.createRecurringTransaction).not.toHaveBeenCalled();
    });
  });
});
