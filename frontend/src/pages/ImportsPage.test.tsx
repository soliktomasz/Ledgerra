import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ImportsPage } from "./ImportsPage";

const mocks = vi.hoisted(() => ({
  analyzeMonthlyReport: vi.fn(),
  commitMonthlyReportDrafts: vi.fn(),
  createImportRule: vi.fn(),
  refresh: vi.fn()
}));

vi.mock("../state/AuthContext", () => ({
  useAuth: () => ({ auth: { accessToken: "token" } })
}));

vi.mock("../api/client", () => ({
  apiClient: {
    analyzeMonthlyReport: mocks.analyzeMonthlyReport,
    previewCsvBankImport: mocks.analyzeMonthlyReport,
    commitMonthlyReportDrafts: mocks.commitMonthlyReportDrafts,
    createImportRule: mocks.createImportRule
  }
}));

vi.mock("../hooks/useLedgerraData", () => ({
  useLedgerraData: () => ({
    accounts: [{ id: "account-1", name: "Checking", type: "Checking", currencyCode: "USD", openingBalance: 0, currentBalance: 0, isActive: true }],
    categories: [
      { id: "category-1", name: "Groceries", kind: "Expense", isSystem: false },
      { id: "category-2", name: "Dining", kind: "Expense", isSystem: false }
    ],
    aiSettings: {
      providers: {
        openAi: { isConfigured: true, maskedKey: "...3456" },
        anthropic: { isConfigured: true, maskedKey: "...abcd" },
        openAiCompatible: { isConfigured: true, maskedKey: "...cdef", baseUrl: "https://api.synthetic.example/v1", model: "synthetic-finance-1" }
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
      target: { files: [new File(["report"], "report.pdf", { type: "application/pdf" })] }
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

  test("renders duplicate and rule metadata with duplicate rows unselected by default", async () => {
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
          note: "Imported: Market",
          confidence: 0.92,
          warnings: [],
          appliedRuleId: "rule-1",
          appliedRuleName: "Market groceries",
          isLikelyDuplicate: true,
          duplicateTransactionId: "transaction-1",
          duplicateReason: "Matches an existing transaction with the same account, date, type, amount, and note.",
          isSelectedByDefault: false
        }
      ]
    });

    render(<ImportsPage />);

    fireEvent.change(screen.getByLabelText("Account"), { target: { value: "account-1" } });
    fireEvent.change(screen.getByLabelText("Report file"), {
      target: { files: [new File(["a,b"], "report.csv", { type: "text/csv" })] }
    });
    fireEvent.submit(screen.getByRole("button", { name: "Analyze report" }).closest("form")!);

    expect(await screen.findByText("Market groceries")).toBeInTheDocument();
    expect(screen.getAllByText(/duplicate/i).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Select row-1")).not.toBeChecked();
  });

  test("sends accepted duplicate source ids for duplicate rows selected by the user", async () => {
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
          note: "Imported: Market",
          confidence: 0.92,
          warnings: [],
          appliedRuleId: null,
          appliedRuleName: null,
          isLikelyDuplicate: true,
          duplicateTransactionId: "transaction-1",
          duplicateReason: "Matches an existing transaction.",
          isSelectedByDefault: false
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

    await screen.findByText("92%");
    await user.click(screen.getByLabelText("Select row-1"));
    await user.click(screen.getByRole("button", { name: "Save selected drafts" }));

    await waitFor(() => {
      expect(mocks.commitMonthlyReportDrafts).toHaveBeenCalledWith("token", expect.any(Array), ["row-1"]);
    });
  });

  test("sends accepted duplicate source ids for duplicate rows selected by default", async () => {
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
          note: "Imported: Market",
          confidence: 0.92,
          warnings: [],
          isLikelyDuplicate: true,
          duplicateTransactionId: "transaction-1",
          duplicateReason: "Matches an existing transaction.",
          isSelectedByDefault: true
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

    await screen.findByText("92%");
    expect(screen.getByLabelText("Select row-1")).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Save selected drafts" }));

    await waitFor(() => {
      expect(mocks.commitMonthlyReportDrafts).toHaveBeenCalledWith("token", expect.any(Array), ["row-1"]);
    });
  });

  test("does not commit when no drafts are selected", async () => {
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
          note: "Imported: Market",
          confidence: 0.92,
          warnings: [],
          isLikelyDuplicate: true,
          duplicateTransactionId: "transaction-1",
          duplicateReason: "Matches an existing transaction.",
          isSelectedByDefault: false
        }
      ]
    });

    render(<ImportsPage />);

    fireEvent.change(screen.getByLabelText("Account"), { target: { value: "account-1" } });
    fireEvent.change(screen.getByLabelText("Report file"), {
      target: { files: [new File(["a,b"], "report.csv", { type: "text/csv" })] }
    });
    fireEvent.submit(screen.getByRole("button", { name: "Analyze report" }).closest("form")!);

    await screen.findByText("92%");
    await user.click(screen.getByRole("button", { name: "Save selected drafts" }));

    expect(mocks.commitMonthlyReportDrafts).not.toHaveBeenCalled();
    expect(await screen.findByText("Select at least one draft to save.")).toBeInTheDocument();
  });

  test("surfaces commit errors without clearing drafts", async () => {
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
          note: "Imported: Market",
          confidence: 0.92,
          warnings: []
        }
      ]
    });
    mocks.commitMonthlyReportDrafts.mockRejectedValue(new Error("Draft row-1 appears to duplicate an existing transaction."));

    render(<ImportsPage />);

    fireEvent.change(screen.getByLabelText("Account"), { target: { value: "account-1" } });
    fireEvent.change(screen.getByLabelText("Report file"), {
      target: { files: [new File(["a,b"], "report.csv", { type: "text/csv" })] }
    });
    fireEvent.submit(screen.getByRole("button", { name: "Analyze report" }).closest("form")!);

    await screen.findByText("92%");
    await user.click(screen.getByRole("button", { name: "Save selected drafts" }));

    expect(await screen.findByText("Draft row-1 appears to duplicate an existing transaction.")).toBeInTheDocument();
    expect(screen.getByLabelText("Select row-1")).toBeInTheDocument();
  });

  test("creates an import rule from a reviewed draft", async () => {
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
          note: "Imported: Market",
          confidence: 0.92,
          warnings: []
        }
      ]
    });
    mocks.createImportRule.mockResolvedValue({ id: "rule-1" });

    render(<ImportsPage />);

    fireEvent.change(screen.getByLabelText("Account"), { target: { value: "account-1" } });
    fireEvent.change(screen.getByLabelText("Report file"), {
      target: { files: [new File(["a,b"], "report.csv", { type: "text/csv" })] }
    });
    fireEvent.submit(screen.getByRole("button", { name: "Analyze report" }).closest("form")!);

    await user.click(await screen.findByRole("button", { name: "Remember this" }));

    expect(mocks.createImportRule).toHaveBeenCalledWith("token", {
      name: "Imported: Market -> Groceries",
      matchField: "Note",
      matchOperator: "Contains",
      matchValue: "Imported: Market",
      assignCategoryId: "category-1",
      assignTransactionType: "Expense",
      priority: 100,
      isActive: true
    });
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Import rule saved.")).toBeInTheDocument();
  });

  test("surfaces import rule creation errors", async () => {
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
          note: "Imported: Market",
          confidence: 0.92,
          warnings: []
        }
      ]
    });
    mocks.createImportRule.mockRejectedValue(new Error("Rule name already exists."));

    render(<ImportsPage />);

    fireEvent.change(screen.getByLabelText("Account"), { target: { value: "account-1" } });
    fireEvent.change(screen.getByLabelText("Report file"), {
      target: { files: [new File(["a,b"], "report.csv", { type: "text/csv" })] }
    });
    fireEvent.submit(screen.getByRole("button", { name: "Analyze report" }).closest("form")!);

    await user.click(await screen.findByRole("button", { name: "Remember this" }));

    expect(await screen.findByText("Rule name already exists.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remember this" })).toBeEnabled();
  });

  test("bulk-selects safe drafts, hides duplicates, and applies a category to selected rows", async () => {
    const user = userEvent.setup();
    mocks.analyzeMonthlyReport.mockResolvedValue({
      warnings: [],
      transactions: [
        {
          sourceId: "row-1",
          accountId: "account-1",
          categoryId: null,
          amount: 18.5,
          type: "Expense",
          occurredOnUtc: "2026-04-11T12:00:00Z",
          note: "Cafe",
          confidence: 0.91,
          warnings: []
        },
        {
          sourceId: "row-2",
          accountId: "account-1",
          categoryId: null,
          amount: 42.17,
          type: "Expense",
          occurredOnUtc: "2026-04-10T12:00:00Z",
          note: "Existing market",
          confidence: 0.95,
          warnings: [],
          isLikelyDuplicate: true,
          duplicateTransactionId: "transaction-1",
          duplicateReason: "Matches an existing transaction.",
          isSelectedByDefault: false
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

    await screen.findByDisplayValue("Cafe");
    await user.click(screen.getByRole("button", { name: "Select safe drafts" }));
    expect(screen.getByLabelText("Select row-1")).toBeChecked();
    expect(screen.getByLabelText("Select row-2")).not.toBeChecked();

    await user.selectOptions(screen.getByLabelText("Bulk category"), "category-2");
    await user.click(screen.getByRole("button", { name: "Apply to selected" }));
    expect(await screen.findByText("Applied Dining to 1 selected draft.")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Hide duplicates"));
    expect(screen.queryByText("Existing market")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save selected drafts" }));

    await waitFor(() => {
      expect(mocks.commitMonthlyReportDrafts).toHaveBeenCalled();
    });
    const [, submittedDrafts] = mocks.commitMonthlyReportDrafts.mock.calls[0];
    expect(submittedDrafts).toHaveLength(1);
    expect(submittedDrafts[0]).toEqual(expect.objectContaining({ sourceId: "row-1", categoryId: "category-2" }));
  });

  test("creates import rules for selected reviewed drafts", async () => {
    const user = userEvent.setup();
    mocks.analyzeMonthlyReport.mockResolvedValue({
      warnings: [],
      transactions: [
        {
          sourceId: "row-1",
          accountId: "account-1",
          categoryId: "category-2",
          amount: 18.5,
          type: "Expense",
          occurredOnUtc: "2026-04-11T12:00:00Z",
          note: "Cafe",
          confidence: 0.91,
          warnings: []
        }
      ]
    });
    mocks.createImportRule.mockResolvedValue({ id: "rule-1" });

    render(<ImportsPage />);

    fireEvent.change(screen.getByLabelText("Account"), { target: { value: "account-1" } });
    fireEvent.change(screen.getByLabelText("Report file"), {
      target: { files: [new File(["a,b"], "report.csv", { type: "text/csv" })] }
    });
    fireEvent.submit(screen.getByRole("button", { name: "Analyze report" }).closest("form")!);

    await screen.findByDisplayValue("Cafe");
    await user.click(screen.getByRole("button", { name: "Remember selected rules" }));

    await waitFor(() => {
      expect(mocks.createImportRule).toHaveBeenCalledWith("token", {
        name: "Cafe -> Dining",
        matchField: "Note",
        matchOperator: "Contains",
        matchValue: "Cafe",
        assignCategoryId: "category-2",
        assignTransactionType: "Expense",
        priority: 100,
        isActive: true
      });
    });
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Saved 1 import rule.")).toBeInTheDocument();
  });
});
