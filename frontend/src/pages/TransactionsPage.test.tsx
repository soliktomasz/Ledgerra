import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TransactionsPage } from "./TransactionsPage";

const mocks = vi.hoisted(() => ({
  createTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  getTransactions: vi.fn(),
  refresh: vi.fn(),
  accounts: [
    { id: "account-1", name: "Checking", type: "Checking", currencyCode: "USD", openingBalance: 0, currentBalance: 0, isActive: true },
    { id: "account-2", name: "Savings", type: "Savings", currencyCode: "USD", openingBalance: 0, currentBalance: 0, isActive: true }
  ],
  categories: [
    { id: "category-1", name: "Groceries", kind: "Expense", isSystem: false },
    { id: "category-2", name: "Salary", kind: "Income", isSystem: false }
  ],
  transactions: [
    {
      id: "transaction-1",
      accountId: "account-1",
      categoryId: "category-1",
      amount: 42.17,
      type: "Expense",
      occurredOnUtc: "2026-04-10T12:00:00Z",
      note: "Market"
    },
    {
      id: "transaction-2",
      accountId: "account-2",
      categoryId: "category-2",
      amount: 3000,
      type: "Income",
      occurredOnUtc: "2026-04-01T08:00:00Z",
      note: "Payroll"
    }
  ]
}));

vi.mock("../state/AuthContext", () => ({
  useAuth: () => ({ auth: { accessToken: "token" } })
}));

vi.mock("../api/client", () => ({
  apiClient: {
    createTransaction: mocks.createTransaction,
    updateTransaction: mocks.updateTransaction,
    deleteTransaction: mocks.deleteTransaction,
    getTransactions: mocks.getTransactions
  }
}));

vi.mock("../hooks/useLedgerraData", () => ({
  useLedgerraData: () => ({
    accounts: mocks.accounts,
    categories: mocks.categories,
    transactions: mocks.transactions,
    refresh: mocks.refresh
  })
}));

describe("TransactionsPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.getTransactions.mockResolvedValue([
      {
        id: "transaction-1",
        accountId: "account-1",
        categoryId: "category-1",
        amount: 42.17,
        type: "Expense",
        occurredOnUtc: "2026-04-10T12:00:00Z",
        note: "Market"
      },
      {
        id: "transaction-2",
        accountId: "account-2",
        categoryId: "category-2",
        amount: 3000,
        type: "Income",
        occurredOnUtc: "2026-04-01T08:00:00Z",
        note: "Payroll"
      }
    ]);
    mocks.createTransaction.mockResolvedValue({ id: "transaction-3" });
    mocks.updateTransaction.mockResolvedValue({ id: "transaction-4" });
    mocks.deleteTransaction.mockResolvedValue(undefined);
  });

  test("loads transactions with filters and searches visible notes", async () => {
    const user = userEvent.setup();

    render(<TransactionsPage />);

    await user.selectOptions(screen.getByLabelText("Filter by account"), "account-1");
    await user.selectOptions(screen.getByLabelText("Filter by category"), "category-1");
    await user.selectOptions(screen.getByLabelText("Filter by type"), "Expense");
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-04-01" } });
    fireEvent.change(screen.getByLabelText("To date"), { target: { value: "2026-04-30" } });
    await user.type(screen.getByLabelText("Search notes"), "market");

    await waitFor(() => {
      expect(mocks.getTransactions).toHaveBeenLastCalledWith(
        "token",
        "?accountId=account-1&categoryId=category-1&type=Expense&from=2026-04-01&to=2026-04-30"
      );
    });

    expect(screen.getByText("Market")).toBeInTheDocument();
    expect(screen.queryByText("Payroll")).not.toBeInTheDocument();
  });

  test("edits a transaction from the ledger", async () => {
    const user = userEvent.setup();

    render(<TransactionsPage />);

    const row = await screen.findByLabelText("Transaction Market");
    await user.click(within(row).getByRole("button", { name: "Edit Market" }));

    expect(screen.getByRole("heading", { name: "Edit transaction" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "50.25" } });
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "Market and pharmacy" } });
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(mocks.updateTransaction).toHaveBeenCalledWith(
        "token",
        "transaction-1",
        expect.objectContaining({
          amount: 50.25,
          categoryId: "category-1",
          note: "Market and pharmacy",
          type: "Expense"
        })
      );
    });
  });

  test("deletes and duplicates transactions from row actions", async () => {
    const user = userEvent.setup();

    render(<TransactionsPage />);

    const row = await screen.findByLabelText("Transaction Market");
    await user.click(within(row).getByRole("button", { name: "Duplicate Market" }));

    await waitFor(() => {
      expect(mocks.createTransaction).toHaveBeenCalledWith(
        "token",
        expect.objectContaining({
          accountId: "account-1",
          categoryId: "category-1",
          amount: 42.17,
          note: "Market",
          type: "Expense"
        })
      );
    });

    await user.click(within(row).getByRole("button", { name: "Delete Market" }));

    await waitFor(() => {
      expect(mocks.deleteTransaction).toHaveBeenCalledWith("token", "transaction-1");
    });
  });
});
