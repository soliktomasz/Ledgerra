import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { BudgetsPage } from "./BudgetsPage";

const mocks = vi.hoisted(() => ({
  updateBudget: vi.fn(),
  refresh: vi.fn(),
  categories: [
    { id: "category-1", name: "Groceries", kind: "Expense", isSystem: false },
    { id: "category-2", name: "Salary", kind: "Income", isSystem: false }
  ],
  budget: {
    totalPlanned: 100,
    totalSpent: 25,
    totalRemaining: 75,
    categories: [
      {
        categoryId: "category-1",
        categoryName: "Groceries",
        planned: 100,
        carryForward: 0,
        available: 100,
        carryOverUnspent: false,
        spent: 25,
        remaining: 75
      }
    ]
  }
}));

vi.mock("../state/AuthContext", () => ({
  useAuth: () => ({ auth: { accessToken: "token" } })
}));

vi.mock("../state/MonthContext", () => ({
  useMonthSelection: () => ({
    selectedMonth: "2025-02",
    selectedYear: 2025,
    selectedMonthNumber: 2
  })
}));

vi.mock("../api/client", () => ({
  apiClient: {
    updateBudget: mocks.updateBudget
  }
}));

vi.mock("../hooks/useLedgerraData", () => ({
  useLedgerraData: () => ({
    categories: mocks.categories,
    budget: mocks.budget,
    profile: { email: "owner@ledgerra.local", preferredCurrencyCode: "USD", preferredLanguageCode: "en" },
    refresh: mocks.refresh
  })
}));

describe("BudgetsPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.updateBudget.mockResolvedValue(mocks.budget);
    mocks.refresh.mockResolvedValue(undefined);
  });

  function renderBudgetsPage() {
    return render(
      <MemoryRouter>
        <BudgetsPage />
      </MemoryRouter>
    );
  }

  test("saves budget changes for the globally selected month", async () => {
    const user = userEvent.setup();

    renderBudgetsPage();

    await user.clear(screen.getByLabelText("Groceries"));
    await user.type(screen.getByLabelText("Groceries"), "125");
    await user.click(screen.getByRole("button", { name: "Save budget" }));

    await waitFor(() => {
      expect(mocks.updateBudget).toHaveBeenCalledWith("token", 2025, 2, [
        { categoryId: "category-1", plannedAmount: 125, carryOverUnspent: false }
      ]);
    });
  });

  test("saves rollover setting with budget changes", async () => {
    const user = userEvent.setup();

    renderBudgetsPage();

    await user.click(screen.getByRole("checkbox", { name: "Rollover" }));
    await user.click(screen.getByRole("button", { name: "Save budget" }));

    await waitFor(() => {
      expect(mocks.updateBudget).toHaveBeenCalledWith("token", 2025, 2, [
        { categoryId: "category-1", plannedAmount: 100, carryOverUnspent: true }
      ]);
    });
  });
});
