import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ImportsPage } from "./ImportsPage";

const mocks = vi.hoisted(() => ({
  analyzeMonthlyReport: vi.fn(),
  commitMonthlyReportDrafts: vi.fn(),
  refresh: vi.fn()
}));

vi.mock("../state/AuthContext", () => ({
  useAuth: () => ({ auth: { accessToken: "token" } })
}));

vi.mock("../api/client", () => ({
  apiClient: {
    analyzeMonthlyReport: mocks.analyzeMonthlyReport,
    commitMonthlyReportDrafts: mocks.commitMonthlyReportDrafts
  }
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
    refresh: mocks.refresh
  })
}));

describe("ImportsPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders monthly report import controls", () => {
    render(<ImportsPage />);

    expect(screen.getByText("Monthly report import")).toBeInTheDocument();
    expect(screen.getByLabelText("Account")).toBeInTheDocument();
    expect(screen.getByLabelText("Report file")).toBeInTheDocument();
  });

  test("surfaces analysis errors and re-enables the submit button", async () => {
    let rejectAnalysis: (error: Error) => void = () => undefined;
    mocks.analyzeMonthlyReport.mockReturnValue(new Promise((_, reject) => {
      rejectAnalysis = reject;
    }));

    render(<ImportsPage />);

    fireEvent.change(screen.getByLabelText("Account"), { target: { value: "account-1" } });
    fireEvent.change(screen.getByLabelText("Report file"), {
      target: { files: [new File(["a,b"], "report.csv", { type: "text/csv" })] }
    });
    fireEvent.submit(screen.getByRole("button", { name: "Analyze report" }).closest("form")!);

    expect(screen.getByRole("button", { name: "Analyzing..." })).toBeDisabled();
    rejectAnalysis(new Error("Provider key is invalid"));
    expect(await screen.findByText("Provider key is invalid")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analyze report" })).toBeEnabled();
  });

  test("keeps edited draft date and amount values safe before commit", async () => {
    const user = userEvent.setup();
    mocks.analyzeMonthlyReport.mockResolvedValue({
      warnings: [],
      transactions: [
        {
          sourceId: "row-1",
          accountId: "account-1",
          categoryId: "category-1",
          amount: 42.17,
          type: "Expense",
          occurredOnUtc: "2026-04-10T12:00:00Z",
          note: "Market",
          confidence: 0.9,
          warnings: []
        }
      ]
    });
    mocks.commitMonthlyReportDrafts.mockResolvedValue({ created: [] });

    render(<ImportsPage />);

    fireEvent.change(screen.getByLabelText("Account"), { target: { value: "account-1" } });
    fireEvent.change(screen.getByLabelText("Report file"), {
      target: { files: [new File(["a,b"], "report.csv", { type: "text/csv" })] }
    });
    fireEvent.submit(screen.getByRole("button", { name: "Analyze report" }).closest("form")!);

    await screen.findByText("90%");

    fireEvent.change(screen.getByDisplayValue("2026-04-10"), { target: { value: "" } });
    fireEvent.change(screen.getByDisplayValue("42.17"), { target: { value: "abc" } });
    await user.click(screen.getByRole("button", { name: "Save selected drafts" }));

    await waitFor(() => {
      expect(mocks.commitMonthlyReportDrafts).toHaveBeenCalled();
    });

    const [, submittedDrafts] = mocks.commitMonthlyReportDrafts.mock.calls[0];
    expect(Number.isFinite(submittedDrafts[0].amount)).toBe(true);
    expect(submittedDrafts[0].occurredOnUtc).toBe("");
  });
});
