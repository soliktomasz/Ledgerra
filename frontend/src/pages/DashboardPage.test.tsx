import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { DashboardPage } from "./DashboardPage";
import type { Account, BudgetSummary, DashboardSummary, Transaction } from "../types";

const mocks = vi.hoisted(() => ({
  data: {
    accounts: [] as Account[],
    categories: [
      { id: "category-1", name: "Groceries", kind: "Expense", isSystem: true },
      { id: "category-2", name: "Salary", kind: "Income", isSystem: true }
    ],
    dashboard: {
      income: 0,
      expenses: 0,
      net: 0,
      budgetRemaining: 0,
      topCategories: [],
      accounts: []
    } as DashboardSummary,
    budget: {
      totalPlanned: 0,
      totalSpent: 0,
      totalRemaining: 0,
      categories: []
    } as BudgetSummary,
    loading: false,
    error: null as string | null,
    profile: { email: "owner@ledgerra.local", preferredCurrencyCode: "USD" },
    transactions: [] as Transaction[]
  }
}));

vi.mock("../hooks/useLedgerraData", () => ({
  useLedgerraData: () => mocks.data
}));

describe("DashboardPage", () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    mocks.data.accounts = [];
    mocks.data.dashboard = {
      income: 0,
      expenses: 0,
      net: 0,
      budgetRemaining: 0,
      topCategories: [],
      accounts: []
    } as DashboardSummary;
    mocks.data.budget = {
      totalPlanned: 0,
      totalSpent: 0,
      totalRemaining: 0,
      categories: []
    } as BudgetSummary;
    mocks.data.transactions = [];
    mocks.data.profile = { email: "owner@ledgerra.local", preferredCurrencyCode: "USD" };
  });

  test("shows first-run checklist progress from current ledger data", () => {
    mocks.data.accounts = [
      {
        id: "account-1",
        name: "Main checking",
        type: "Checking",
        currencyCode: "USD",
        openingBalance: 500,
        currentBalance: 500,
        isActive: true
      }
    ];
    mocks.data.budget = {
      totalPlanned: 300,
      totalSpent: 0,
      totalRemaining: 300,
      categories: [
        {
          categoryId: "category-1",
          categoryName: "Groceries",
          planned: 300,
          spent: 0,
          remaining: 300
        }
      ]
    };

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByText("First run checklist")).toBeInTheDocument();
    expect(screen.getByText("2 of 5 complete")).toBeInTheDocument();
    expect(screen.getByText("Main checking")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add first transaction" })).toHaveAttribute("href", "/transactions");
  });

  test("lets users acknowledge currency and default categories without resetting on currency changes", async () => {
    const user = userEvent.setup();

    const { rerender } = render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: "Confirm USD" }));
    expect(screen.getByRole("link", { name: "Open categories" })).toHaveAttribute("href", "/categories");
    await user.click(screen.getByRole("button", { name: "Reviewed" }));

    expect(screen.getByText("2 of 5 complete")).toBeInTheDocument();
    expect(screen.getByText("Currency confirmed")).toBeInTheDocument();
    expect(screen.getByText("Categories reviewed")).toBeInTheDocument();

    mocks.data.profile = { email: "owner@ledgerra.local", preferredCurrencyCode: "EUR" };
    rerender(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByText("2 of 5 complete")).toBeInTheDocument();
    expect(screen.getByText("Currency confirmed")).toBeInTheDocument();
    expect(screen.getByText("Categories reviewed")).toBeInTheDocument();
  });

  test("hides onboarding checklist after every step is complete", () => {
    localStorage.setItem(
      "ledgerra:onboarding:owner@ledgerra.local",
      JSON.stringify({ currency: true, categories: true })
    );
    mocks.data.accounts = [
      {
        id: "account-1",
        name: "Main checking",
        type: "Checking",
        currencyCode: "USD",
        openingBalance: 500,
        currentBalance: 500,
        isActive: true
      }
    ];
    mocks.data.budget = {
      totalPlanned: 300,
      totalSpent: 0,
      totalRemaining: 300,
      categories: [
        {
          categoryId: "category-1",
          categoryName: "Groceries",
          planned: 300,
          spent: 0,
          remaining: 300
        }
      ]
    };
    mocks.data.transactions = [
      {
        id: "transaction-1",
        accountId: "account-1",
        categoryId: "category-1",
        amount: 12,
        type: "Expense",
        occurredOnUtc: "2026-04-30T10:00:00Z",
        note: "Coffee"
      }
    ];

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(screen.queryByLabelText("Onboarding checklist")).not.toBeInTheDocument();
  });
});
