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
      accounts: [],
      trends: {
        spendingDeltaAmount: 0,
        spendingDeltaPercent: null,
        spendingSparkline: []
      }
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
      accounts: [],
      trends: {
        spendingDeltaAmount: 0,
        spendingDeltaPercent: null,
        spendingSparkline: []
      }
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

  test("shows actionable insights for budget pressure and uncategorized transactions", () => {
    mocks.data.dashboard = {
      income: 4000,
      expenses: 1240,
      net: 2760,
      budgetRemaining: 260,
      topCategories: [],
      accounts: [],
      trends: {
        spendingDeltaAmount: 60,
        spendingDeltaPercent: 12.5,
        spendingSparkline: [
          { month: "2026-03", amount: 480 },
          { month: "2026-04", amount: 540 }
        ]
      }
    } as DashboardSummary;
    mocks.data.budget = {
      totalPlanned: 1500,
      totalSpent: 1240,
      totalRemaining: 260,
      categories: [
        {
          categoryId: "category-1",
          categoryName: "Dining",
          planned: 500,
          spent: 410,
          remaining: 90
        },
        {
          categoryId: "category-3",
          categoryName: "Subscriptions",
          planned: 100,
          spent: 105,
          remaining: -5
        }
      ]
    };
    mocks.data.transactions = [
      {
        id: "transaction-1",
        accountId: "account-1",
        categoryId: null,
        amount: 12,
        type: "Expense",
        occurredOnUtc: "2026-04-30T10:00:00Z",
        note: "Coffee"
      },
      {
        id: "transaction-2",
        accountId: "account-1",
        amount: 20,
        type: "Expense",
        occurredOnUtc: "2026-04-29T10:00:00Z",
        note: "Lunch"
      },
      {
        id: "transaction-3",
        accountId: "account-1",
        categoryId: "category-1",
        amount: 30,
        type: "Expense",
        occurredOnUtc: "2026-04-28T10:00:00Z",
        note: "Dinner"
      }
    ];

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Insights")).toBeInTheDocument();
    expect(screen.getByText("Dining is 82% of its budget.")).toBeInTheDocument();
    expect(screen.getByText("Subscriptions is over budget by $5.00.")).toBeInTheDocument();
    expect(screen.getByText("You have 2 uncategorized expense transactions.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review transactions" })).toHaveAttribute("href", "/transactions?view=uncategorized");
  });

  test("prompts users to set a budget when transactions exist without planned limits", () => {
    mocks.data.budget = {
      totalPlanned: 0,
      totalSpent: 0,
      totalRemaining: 0,
      categories: []
    };
    mocks.data.transactions = [
      {
        id: "transaction-1",
        accountId: "account-1",
        categoryId: "category-1",
        amount: 45,
        type: "Expense",
        occurredOnUtc: "2026-04-30T10:00:00Z",
        note: "Market"
      }
    ];

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Set a monthly budget to turn spending into progress alerts.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open budgets" })).toHaveAttribute("href", "/budgets");
  });

  test("shows a compact trends teaser linking to reports", () => {
    mocks.data.dashboard = {
      income: 4000,
      expenses: 540,
      net: 3460,
      budgetRemaining: 260,
      topCategories: [],
      accounts: [],
      trends: {
        spendingDeltaAmount: 60,
        spendingDeltaPercent: 12.5,
        spendingSparkline: [
          { month: "2026-01", amount: 300 },
          { month: "2026-02", amount: 420 },
          { month: "2026-03", amount: 480 },
          { month: "2026-04", amount: 540 }
        ]
      }
    } as DashboardSummary;

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Reports preview")).toBeInTheDocument();
    expect(screen.getByText("Spending is up $60.00 vs prior month.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open reports" })).toHaveAttribute("href", "/reports");
  });
});
