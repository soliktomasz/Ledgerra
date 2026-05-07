import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TransactionsPage } from "./TransactionsPage";

const mocks = vi.hoisted(() => ({
  createCategory: vi.fn(),
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
    { id: "category-2", name: "Salary", kind: "Income", isSystem: false },
    { id: "category-3", name: "Dining", kind: "Expense", isSystem: false }
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
    createCategory: mocks.createCategory,
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
    window.history.replaceState(null, "", "/transactions");
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
    mocks.createCategory.mockResolvedValue({
      id: "category-new",
      name: "Pets",
      kind: "Expense",
      color: "#ff8800",
      isSystem: false
    });
    mocks.createTransaction.mockResolvedValue({ id: "transaction-3" });
    mocks.updateTransaction.mockResolvedValue({ id: "transaction-4" });
    mocks.deleteTransaction.mockResolvedValue(undefined);
  });

  test("loads transactions with filters and searches visible notes", async () => {
    const user = userEvent.setup();

    render(<TransactionsPage />);

    await user.selectOptions(screen.getByLabelText("Filter by account"), ["account-1"]);
    await user.selectOptions(screen.getByLabelText("Filter by category"), ["category-1"]);
    await user.selectOptions(screen.getByLabelText("Filter by type"), "Expense");
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-04-01" } });
    fireEvent.change(screen.getByLabelText("To date"), { target: { value: "2026-04-30" } });
    fireEvent.change(screen.getByLabelText("Min amount"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Max amount"), { target: { value: "100" } });
    await user.type(screen.getByLabelText("Search notes"), "market");

    await waitFor(() => {
      expect(mocks.getTransactions).toHaveBeenLastCalledWith(
        "token",
        "?accountId=account-1&categoryId=category-1&type=Expense&from=2026-04-01&to=2026-04-30"
      );
    });

    expect(screen.getByText("Market")).toBeInTheDocument();
    expect(screen.queryByText("Payroll")).not.toBeInTheDocument();
    expect(window.location.search).toContain("accountId=account-1");
    expect(window.location.search).toContain("categoryId=category-1");
    expect(window.location.search).toContain("minAmount=10");
    expect(window.location.search).toContain("maxAmount=100");
    expect(window.location.search).toContain("q=market");
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

  test("filters uncategorized expenses and assigns a category from the workflow", async () => {
    const user = userEvent.setup();
    mocks.getTransactions.mockResolvedValue([
      {
        id: "transaction-3",
        accountId: "account-1",
        categoryId: null,
        amount: 18.5,
        type: "Expense",
        occurredOnUtc: "2026-04-12T12:00:00Z",
        note: "Cafe"
      },
      {
        id: "transaction-4",
        accountId: "account-1",
        categoryId: "category-1",
        amount: 42.17,
        type: "Expense",
        occurredOnUtc: "2026-04-10T12:00:00Z",
        note: "Market"
      }
    ]);

    render(<TransactionsPage />);

    await user.click(await screen.findByLabelText("Needs category"));

    expect(screen.getByText("Cafe")).toBeInTheDocument();
    expect(screen.queryByText("Market")).not.toBeInTheDocument();
    expect(screen.getByText(/1 uncategorized expense transaction needs review\./)).toBeInTheDocument();

    const row = screen.getByLabelText("Transaction Cafe");
    await user.selectOptions(within(row).getByLabelText("Assign category to Cafe"), "category-3");

    await waitFor(() => {
      expect(mocks.updateTransaction).toHaveBeenCalledWith(
        "token",
        "transaction-3",
        expect.objectContaining({
          categoryId: "category-3",
          amount: 18.5,
          note: "Cafe",
          type: "Expense"
        })
      );
    });
    expect(await screen.findByText("Cafe categorized as Dining.")).toBeInTheDocument();
  });

  test("creates a missing category while saving a transaction", async () => {
    const user = userEvent.setup();

    render(<TransactionsPage />);

    await user.selectOptions(screen.getByLabelText("Type"), "Expense");
    await user.selectOptions(screen.getByLabelText("Account"), "account-1");
    await user.selectOptions(screen.getByLabelText("Category"), "__create_new__");
    await user.type(screen.getByLabelText("New category name"), "Pets");
    fireEvent.change(screen.getByLabelText("New category color"), { target: { value: "#ff8800" } });
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "24.5" } });
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "Cat food" } });
    await user.click(screen.getByRole("button", { name: "Save transaction" }));

    await waitFor(() => {
      expect(mocks.createCategory).toHaveBeenCalledWith("token", {
        name: "Pets",
        kind: "Expense",
        color: "#ff8800"
      });
    });
    expect(mocks.createTransaction).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({
        accountId: "account-1",
        categoryId: "category-new",
        amount: 24.5,
        type: "Expense",
        note: "Cat food"
      })
    );
  });

  test("hides category creation for transfers", async () => {
    const user = userEvent.setup();

    render(<TransactionsPage />);

    await user.selectOptions(screen.getByLabelText("Type"), "Transfer");

    expect(screen.queryByLabelText("Category")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("New category name")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Destination account")).toBeInTheDocument();
  });
});
