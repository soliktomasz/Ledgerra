import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { ImportsPage } from "./ImportsPage";

vi.mock("../state/AuthContext", () => ({
  useAuth: () => ({ auth: { accessToken: "token" } })
}));

vi.mock("../hooks/useLedgerraData", () => ({
  useLedgerraData: () => ({
    accounts: [{ id: "account-1", name: "Checking", type: "Checking", currencyCode: "USD", openingBalance: 0, currentBalance: 0, isActive: true }],
    categories: [{ id: "category-1", name: "Groceries", kind: "Expense", isSystem: false }],
    aiSettings: {
      providers: {
        openAi: { isConfigured: true, maskedKey: "...3456" },
        anthropic: { isConfigured: true, maskedKey: "...abcd" }
      },
      defaultProvider: "OpenAi"
    },
    refresh: vi.fn()
  })
}));

describe("ImportsPage", () => {
  test("renders monthly report import controls", () => {
    render(<ImportsPage />);

    expect(screen.getByText("Monthly report import")).toBeInTheDocument();
    expect(screen.getByLabelText("Account")).toBeInTheDocument();
    expect(screen.getByLabelText("Report file")).toBeInTheDocument();
  });
});
