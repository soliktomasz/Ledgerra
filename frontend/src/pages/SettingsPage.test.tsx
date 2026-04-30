import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { SettingsPage } from "./SettingsPage";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  updateProfile: vi.fn(),
  saveAiProviderKey: vi.fn(),
  removeAiProviderKey: vi.fn(),
  updateDefaultAiProvider: vi.fn(),
  createImportRule: vi.fn(),
  updateImportRule: vi.fn(),
  deleteImportRule: vi.fn(),
  aiSettings: {
    providers: {
      openAi: { isConfigured: true, maskedKey: "...3456" as string | null },
      anthropic: { isConfigured: false, maskedKey: null as string | null }
    },
    defaultProvider: "OpenAi"
  }
}));

vi.mock("../state/AuthContext", () => ({
  useAuth: () => ({ auth: { accessToken: "token", email: "owner@ledgerra.local" } })
}));

vi.mock("../api/client", () => ({
  apiClient: {
    updateProfile: mocks.updateProfile,
    saveAiProviderKey: mocks.saveAiProviderKey,
    removeAiProviderKey: mocks.removeAiProviderKey,
    updateDefaultAiProvider: mocks.updateDefaultAiProvider,
    createImportRule: mocks.createImportRule,
    updateImportRule: mocks.updateImportRule,
    deleteImportRule: mocks.deleteImportRule
  }
}));

vi.mock("../hooks/useLedgerraData", () => ({
  useLedgerraData: () => ({
    profile: { email: "owner@ledgerra.local", preferredCurrencyCode: "USD" },
    aiSettings: mocks.aiSettings,
    categories: [
      { id: "category-1", name: "Groceries", kind: "Expense", isSystem: false },
      { id: "category-2", name: "Salary", kind: "Income", isSystem: false }
    ],
    importRules: [
      {
        id: "rule-1",
        name: "Market groceries",
        matchField: "Note",
        matchOperator: "Contains",
        matchValue: "Market",
        assignCategoryId: "category-1",
        assignTransactionType: "Expense",
        priority: 10,
        isActive: true,
        createdAtUtc: "2026-04-29T10:00:00Z",
        updatedAtUtc: "2026-04-29T10:00:00Z"
      }
    ],
    refresh: mocks.refresh
  })
}));

describe("SettingsPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.aiSettings.providers.openAi = { isConfigured: true, maskedKey: "...3456" };
    mocks.aiSettings.providers.anthropic = { isConfigured: false, maskedKey: null };
    mocks.aiSettings.defaultProvider = "OpenAi";
  });

  test("shows AI provider configuration state", () => {
    render(<SettingsPage />);

    expect(screen.getByText("AI providers")).toBeInTheDocument();
    expect(screen.getByText("...3456")).toBeInTheDocument();
    expect(screen.getAllByText("Not configured").length).toBeGreaterThan(0);
  });

  test("saves provider keys and selected default provider", async () => {
    const user = userEvent.setup();
    mocks.saveAiProviderKey.mockResolvedValue(mocks.aiSettings);
    mocks.updateDefaultAiProvider.mockResolvedValue(mocks.aiSettings);

    render(<SettingsPage />);

    await user.type(screen.getByLabelText("OpenAI API key"), "sk-test-openai-secret-3456");
    await user.selectOptions(screen.getByLabelText("Default provider"), "OpenAi");
    await user.click(screen.getByRole("button", { name: "Save AI settings" }));

    await waitFor(() => {
      expect(mocks.saveAiProviderKey).toHaveBeenCalledWith("token", "openai", "sk-test-openai-secret-3456");
    });
    expect(mocks.updateDefaultAiProvider).toHaveBeenCalledWith("token", "OpenAi");
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByText("...3456")).toBeInTheDocument();
  });

  test("removes configured provider keys and disables missing provider removal", async () => {
    const user = userEvent.setup();
    mocks.removeAiProviderKey.mockResolvedValue(mocks.aiSettings);

    const { rerender } = render(<SettingsPage />);

    const removeButtons = screen.getAllByRole("button", { name: "Remove" });
    expect(removeButtons[0]).toBeEnabled();
    expect(removeButtons[1]).toBeDisabled();

    await user.click(removeButtons[0]);

    await waitFor(() => {
      expect(mocks.removeAiProviderKey).toHaveBeenCalledWith("token", "openai");
    });

    mocks.aiSettings.providers.openAi = { isConfigured: false, maskedKey: null };
    rerender(<SettingsPage />);

    expect(screen.getAllByText("Not configured").length).toBeGreaterThanOrEqual(2);
  });

  test("manages import categorization rules", async () => {
    const user = userEvent.setup();
    mocks.createImportRule.mockResolvedValue({ id: "rule-2" });
    mocks.updateImportRule.mockResolvedValue({ id: "rule-1", isActive: false });
    mocks.deleteImportRule.mockResolvedValue(undefined);

    render(<SettingsPage />);

    expect(screen.getByText("Import rules")).toBeInTheDocument();
    expect(screen.getByText("Market groceries")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Rule name"), "Coffee");
    await user.type(screen.getByLabelText("Match text"), "Cafe");
    await user.click(screen.getByRole("button", { name: "Add rule" }));

    await waitFor(() => {
      expect(mocks.createImportRule).toHaveBeenCalledWith("token", {
        name: "Coffee",
        matchField: "Note",
        matchOperator: "Contains",
        matchValue: "Cafe",
        assignCategoryId: "category-1",
        assignTransactionType: "Expense",
        priority: 100,
        isActive: true
      });
    });

    await user.click(screen.getByRole("button", { name: "Disable Market groceries" }));

    await waitFor(() => {
      expect(mocks.updateImportRule).toHaveBeenCalledWith(
        "token",
        expect.objectContaining({
          id: "rule-1",
          isActive: false
        })
      );
    });

    await user.click(screen.getByRole("button", { name: "Delete Market groceries" }));

    await waitFor(() => {
      expect(mocks.deleteImportRule).toHaveBeenCalledWith("token", "rule-1");
    });
  });

  test("creates income import rules with income categories", async () => {
    const user = userEvent.setup();
    mocks.createImportRule.mockResolvedValue({ id: "rule-2" });

    render(<SettingsPage />);

    await user.selectOptions(screen.getByLabelText("Transaction type"), "Income");
    expect(screen.getByLabelText("Category")).toHaveValue("category-2");

    await user.type(screen.getByLabelText("Rule name"), "Paycheck");
    await user.type(screen.getByLabelText("Match text"), "Payroll");
    await user.click(screen.getByRole("button", { name: "Add rule" }));

    await waitFor(() => {
      expect(mocks.createImportRule).toHaveBeenCalledWith("token", {
        name: "Paycheck",
        matchField: "Note",
        matchOperator: "Contains",
        matchValue: "Payroll",
        assignCategoryId: "category-2",
        assignTransactionType: "Income",
        priority: 100,
        isActive: true
      });
    });
  });

  test("does not submit whitespace-only import rule fields", async () => {
    const user = userEvent.setup();

    render(<SettingsPage />);

    await user.type(screen.getByLabelText("Rule name"), "   ");
    await user.type(screen.getByLabelText("Match text"), "   ");
    await user.click(screen.getByRole("button", { name: "Add rule" }));

    expect(mocks.createImportRule).not.toHaveBeenCalled();
    expect(await screen.findByText("Rule name and match text are required.")).toBeInTheDocument();
  });

  test("shows import rule creation errors", async () => {
    const user = userEvent.setup();
    mocks.createImportRule.mockRejectedValue(new Error("Rule name already exists."));

    render(<SettingsPage />);

    await user.type(screen.getByLabelText("Rule name"), "Coffee");
    await user.type(screen.getByLabelText("Match text"), "Cafe");
    await user.click(screen.getByRole("button", { name: "Add rule" }));

    expect(await screen.findByText("Rule name already exists.")).toBeInTheDocument();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  test("changes the default provider through the settings form", async () => {
    const user = userEvent.setup();
    mocks.aiSettings.providers.anthropic = { isConfigured: true, maskedKey: "...cdef" };
    mocks.updateDefaultAiProvider.mockResolvedValue(mocks.aiSettings);

    const { rerender } = render(<SettingsPage />);

    await user.selectOptions(screen.getByLabelText("Default provider"), "Anthropic");
    await user.click(screen.getByRole("button", { name: "Save AI settings" }));

    await waitFor(() => {
      expect(mocks.updateDefaultAiProvider).toHaveBeenCalledWith("token", "Anthropic");
    });

    mocks.aiSettings.defaultProvider = "Anthropic";
    rerender(<SettingsPage />);

    expect(screen.getByLabelText("Default provider")).toHaveValue("Anthropic");
  });
});
