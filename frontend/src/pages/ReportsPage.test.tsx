import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ReportsPage } from "./ReportsPage";
import type { ReportingOverview } from "../types";

const overview: ReportingOverview = {
  rangePreset: "12M",
  startMonth: "2025-05",
  endMonth: "2026-04",
  currencyCode: "USD",
  summary: {
    incomeTotal: 6200,
    expenseTotal: 350,
    netCashFlow: 5850,
    spendingDeltaAmount: -150,
    spendingDeltaPercent: -50,
    netWorthDelta: 3050
  },
  monthlySpendingTrend: [
    { month: "2026-02", amount: 200 },
    { month: "2026-03", amount: 150 },
    { month: "2026-04", amount: 0 }
  ],
  incomeVsExpense: [
    { month: "2026-02", income: 3000, expenses: 200, net: 2800 },
    { month: "2026-03", income: 3200, expenses: 150, net: 3050 },
    { month: "2026-04", income: 0, expenses: 0, net: 0 }
  ],
  categoryBreakdown: [
    { categoryId: "category-1", categoryName: "Groceries", amount: 350, percentage: 100 }
  ],
  netWorthHistory: [
    { month: "2026-02", netWorth: 3800, currencyCode: "USD" },
    { month: "2026-03", netWorth: 6850, currencyCode: "USD" },
    { month: "2026-04", netWorth: 6850, currencyCode: "USD" }
  ],
  warnings: []
};

const mocks = vi.hoisted(() => ({
  state: {
    overview: null as ReportingOverview | null,
    loading: false,
    error: null as string | null,
    rangePreset: "12M",
    accountId: "",
    setRangePreset: vi.fn(),
    setAccountId: vi.fn(),
    accounts: [
      {
        id: "account-1",
        name: "Checking",
        type: "Checking",
        currencyCode: "USD",
        openingBalance: 1000,
        currentBalance: 6850,
        isActive: true
      }
    ]
  }
}));

vi.mock("../hooks/useReportingOverview", () => ({
  useReportingOverview: () => mocks.state
}));

describe("ReportsPage", () => {
  beforeEach(() => {
    cleanup();
    mocks.state.overview = overview;
    mocks.state.loading = false;
    mocks.state.error = null;
    mocks.state.rangePreset = "12M";
    mocks.state.accountId = "";
    mocks.state.setRangePreset.mockClear();
    mocks.state.setAccountId.mockClear();
  });

  test("renders the reporting overview with compact chart sections", () => {
    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Reports" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "12M" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("$350.00")).toBeInTheDocument();
    expect(screen.getByText("$6,850.00")).toBeInTheDocument();
    expect(screen.getByText("Spending trend")).toBeInTheDocument();
    expect(screen.getByText("Income vs expense")).toBeInTheDocument();
    expect(screen.getByText("Category breakdown")).toBeInTheDocument();
    expect(screen.getByText("Net worth history")).toBeInTheDocument();
    expect(screen.getByText("Groceries")).toBeInTheDocument();
  });

  test("updates the selected range preset", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: "3M" }));

    expect(mocks.state.setRangePreset).toHaveBeenCalledWith("3M");
  });

  test("shows mixed-currency warnings and empty chart states", () => {
    mocks.state.overview = {
      ...overview,
      monthlySpendingTrend: [],
      incomeVsExpense: [],
      categoryBreakdown: [],
      netWorthHistory: [],
      warnings: [
        {
          code: "MixedCurrencyNetWorthExcluded",
          message: "Net worth history is hidden because the selected accounts use multiple currencies."
        }
      ]
    };

    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Net worth history is hidden because the selected accounts use multiple currencies.")).toBeInTheDocument();
    expect(screen.getAllByText("No report data yet")).toHaveLength(4);
  });
});
