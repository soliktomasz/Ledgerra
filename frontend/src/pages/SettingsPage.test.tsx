import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ThemeProvider } from "../state/ThemeContext";
import { SettingsPage } from "./SettingsPage";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  updateProfile: vi.fn(),
  saveAiProviderKey: vi.fn(),
  updateAiProviderModel: vi.fn(),
  getAiProviderModels: vi.fn(),
  removeAiProviderKey: vi.fn(),
  updateDefaultAiProvider: vi.fn(),
  getPersonalAccessTokens: vi.fn(),
  createPersonalAccessToken: vi.fn(),
  revokePersonalAccessToken: vi.fn(),
  clearAccountData: vi.fn(),
  deleteAccount: vi.fn(),
  logout: vi.fn(),
  createImportRule: vi.fn(),
  updateImportRule: vi.fn(),
  deleteImportRule: vi.fn(),
  upsertExchangeRate: vi.fn(),
  deleteExchangeRate: vi.fn(),
  aiSettings: {
    providers: {
      openAi: { isConfigured: true, maskedKey: "...3456" as string | null },
      anthropic: { isConfigured: false, maskedKey: null as string | null },
      openAiCompatible: { isConfigured: false, maskedKey: null as string | null, baseUrl: null as string | null, model: null as string | null }
    },
    defaultProvider: "OpenAi"
  }
}));

vi.mock("../state/AuthContext", () => ({
  useAuth: () => ({ auth: { accessToken: "token", email: "owner@ledgerra.local" }, logout: mocks.logout })
}));

vi.mock("../api/client", () => ({
  apiClient: {
    updateProfile: mocks.updateProfile,
    saveAiProviderKey: mocks.saveAiProviderKey,
    updateAiProviderModel: mocks.updateAiProviderModel,
    getAiProviderModels: mocks.getAiProviderModels,
    removeAiProviderKey: mocks.removeAiProviderKey,
    updateDefaultAiProvider: mocks.updateDefaultAiProvider,
    getPersonalAccessTokens: mocks.getPersonalAccessTokens,
    createPersonalAccessToken: mocks.createPersonalAccessToken,
    revokePersonalAccessToken: mocks.revokePersonalAccessToken,
    clearAccountData: mocks.clearAccountData,
    deleteAccount: mocks.deleteAccount,
    createImportRule: mocks.createImportRule,
    updateImportRule: mocks.updateImportRule,
    deleteImportRule: mocks.deleteImportRule,
    upsertExchangeRate: mocks.upsertExchangeRate,
    deleteExchangeRate: mocks.deleteExchangeRate
  }
}));

vi.mock("../hooks/useLedgerraData", () => ({
  useLedgerraData: () => ({
    profile: { email: "owner@ledgerra.local", preferredCurrencyCode: "USD", preferredLanguageCode: "en" },
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
    exchangeRates: [
      { id: "fx-1", fromCurrencyCode: "EUR", toCurrencyCode: "USD", month: "2026-04", rate: 1.1, updatedAtUtc: "2026-04-30T10:00:00Z" }
    ],
    refresh: mocks.refresh
  })
}));

describe("SettingsPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-density");
    document.documentElement.removeAttribute("data-motion");
    document.documentElement.removeAttribute("data-navigation-density");
    mocks.aiSettings.providers.openAi = { isConfigured: true, maskedKey: "...3456" };
    mocks.aiSettings.providers.anthropic = { isConfigured: false, maskedKey: null };
    mocks.aiSettings.providers.openAiCompatible = { isConfigured: false, maskedKey: null, baseUrl: null, model: null };
    mocks.aiSettings.defaultProvider = "OpenAi";
    mocks.getPersonalAccessTokens.mockResolvedValue([]);
    mocks.createPersonalAccessToken.mockResolvedValue({ plainTextToken: "ledgerra_pat_test" });
    mocks.revokePersonalAccessToken.mockResolvedValue(undefined);
    mocks.clearAccountData.mockResolvedValue(undefined);
    mocks.deleteAccount.mockResolvedValue(undefined);
    mocks.getAiProviderModels.mockResolvedValue({ models: ["synthetic-finance-1", "synthetic-fast"] });
    mocks.upsertExchangeRate.mockResolvedValue({ id: "fx-2", fromCurrencyCode: "EUR", toCurrencyCode: "USD", month: "2026-05", rate: 1.2, updatedAtUtc: "2026-05-01T10:00:00Z" });
    mocks.deleteExchangeRate.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("shows AI provider configuration state", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    expect(screen.getByRole("heading", { name: "Appearance" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^AI/ }));

    expect(screen.getByRole("heading", { name: "AI providers" })).toBeInTheDocument();
    expect(screen.getByText("...3456")).toBeInTheDocument();
    expect(screen.getAllByText("Not configured").length).toBeGreaterThan(0);
  });

  test("updates and persists the selected theme preference", async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider initialThemePreference="system">
        <SettingsPage />
      </ThemeProvider>
    );

    expect(screen.getByRole("button", { name: "Match system" })).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.dataset.theme).toBe("light");

    await user.click(screen.getByRole("button", { name: "Dark" }));

    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem("ledgerra:theme")).toBe("dark");
    expect(screen.getByText("Ledgerra is currently using the dark theme.")).toBeInTheDocument();
  });

  test("saves currency and language preferences", async () => {
    const user = userEvent.setup();
    mocks.updateProfile.mockResolvedValue({
      email: "owner@ledgerra.local",
      preferredCurrencyCode: "PLN",
      preferredLanguageCode: "pl"
    });

    render(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "Region and language" }));

    await user.selectOptions(screen.getByLabelText("Preferred currency"), "PLN");
    await user.selectOptions(screen.getByLabelText("Preferred language"), "pl");
    await user.click(screen.getByRole("button", { name: "Save preferences" }));

    await waitFor(() => {
      expect(mocks.updateProfile).toHaveBeenCalledWith("token", "PLN", "pl");
    });
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });


  test("manages manual FX rates in regional settings", async () => {
    const user = userEvent.setup();

    render(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "Region and language" }));

    expect(screen.getByRole("heading", { name: "Manual FX rates" })).toBeInTheDocument();
    expect(screen.getByText("EUR → USD")).toBeInTheDocument();
    expect(screen.getByText("2026-04")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete EUR to USD 2026-04" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "FX rate actions for EUR to USD 2026-04" }));
    await user.click(screen.getByRole("button", { name: "Delete EUR to USD 2026-04" }));

    await waitFor(() => {
      expect(mocks.deleteExchangeRate).toHaveBeenCalledWith("token", "fx-1");
    });

    await user.selectOptions(screen.getByLabelText("From currency"), "EUR");
    await user.clear(screen.getByLabelText("Month"));
    await user.type(screen.getByLabelText("Month"), "2026-05");
    await user.type(screen.getByLabelText("Rate"), "1.2");
    await user.click(screen.getByRole("button", { name: "Save FX rate" }));

    await waitFor(() => {
      expect(mocks.upsertExchangeRate).toHaveBeenCalledWith("token", {
        fromCurrencyCode: "EUR",
        toCurrencyCode: "USD",
        month: "2026-05",
        rate: 1.2
      });
    });
  });

  test("saves provider keys and selected default provider", async () => {
    const user = userEvent.setup();
    mocks.saveAiProviderKey.mockResolvedValue(mocks.aiSettings);
    mocks.updateDefaultAiProvider.mockResolvedValue(mocks.aiSettings);

    render(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: /^AI/ }));
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

  test("saves OpenAI-compatible provider settings and model", async () => {
    const user = userEvent.setup();
    mocks.saveAiProviderKey.mockResolvedValue(mocks.aiSettings);
    mocks.updateDefaultAiProvider.mockResolvedValue(mocks.aiSettings);

    render(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: /^AI/ }));
    await user.selectOptions(screen.getByLabelText("Default provider"), "OpenAiCompatible");
    await user.type(screen.getByLabelText("OpenAI-compatible API key"), "sk-compatible-secret-3456");
    await user.type(screen.getByLabelText("OpenAI-compatible base URL"), "https://api.synthetic.example/v1");
    await user.type(screen.getByLabelText("OpenAI-compatible model"), "synthetic-finance-1");
    await user.click(screen.getByRole("button", { name: "Save AI settings" }));

    await waitFor(() => {
      expect(mocks.saveAiProviderKey).toHaveBeenCalledWith("token", "openai-compatible", "sk-compatible-secret-3456", {
        baseUrl: "https://api.synthetic.example/v1",
        model: "synthetic-finance-1"
      });
    });
    expect(mocks.updateDefaultAiProvider).toHaveBeenCalledWith("token", "OpenAiCompatible");
  });

  test("loads OpenAI-compatible models for selection", async () => {
    const user = userEvent.setup();
    mocks.aiSettings.providers.openAiCompatible = {
      isConfigured: true,
      maskedKey: "...3456",
      baseUrl: "https://api.synthetic.example/v1",
      model: null
    };

    render(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: /^AI/ }));
    await user.click(screen.getByRole("button", { name: "Load models" }));

    await waitFor(() => {
      expect(mocks.getAiProviderModels).toHaveBeenCalledWith("token", "openai-compatible");
    });
    expect(screen.getByLabelText("OpenAI-compatible model")).toHaveValue("synthetic-finance-1");
  });

  test("explains why OpenAI-compatible model loading is disabled before configuration", async () => {
    const user = userEvent.setup();

    render(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: /^AI/ }));

    expect(screen.getByRole("button", { name: "Load models" })).toBeDisabled();
    expect(screen.getByText("Configure the compatible provider API key first.")).toBeInTheDocument();
  });

  test("removes configured provider keys and disables missing provider removal", async () => {
    const user = userEvent.setup();
    mocks.removeAiProviderKey.mockResolvedValue(mocks.aiSettings);

    const { rerender } = render(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: /^AI/ }));

    expect(screen.queryByRole("button", { name: "Remove OpenAI" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Provider actions for OpenAI" }));
    const removeOpenAiButton = screen.getByRole("button", { name: "Remove OpenAI" });
    expect(removeOpenAiButton).toBeEnabled();

    await user.click(removeOpenAiButton);

    await waitFor(() => {
      expect(mocks.removeAiProviderKey).toHaveBeenCalledWith("token", "openai");
    });

    await user.click(screen.getByRole("button", { name: "Provider actions for Anthropic" }));
    expect(screen.getByRole("button", { name: "Remove Anthropic" })).toBeDisabled();

    mocks.aiSettings.providers.openAi = { isConfigured: false, maskedKey: null };
    rerender(<SettingsPage />);

    expect(screen.getAllByText("Not configured").length).toBeGreaterThanOrEqual(3);
  });

  test("manages import categorization rules", async () => {
    const user = userEvent.setup();
    mocks.createImportRule.mockResolvedValue({ id: "rule-2" });
    mocks.updateImportRule.mockResolvedValue({ id: "rule-1", isActive: false });
    mocks.deleteImportRule.mockResolvedValue(undefined);

    render(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: /^Rules/ }));

    expect(screen.getByRole("heading", { name: "Import rules" })).toBeInTheDocument();
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

    expect(screen.queryByRole("button", { name: "Disable Market groceries" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Rule actions for Market groceries" }));
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

    await user.click(screen.getByRole("button", { name: "Rule actions for Market groceries" }));
    await user.click(screen.getByRole("button", { name: "Delete Market groceries" }));

    await waitFor(() => {
      expect(mocks.deleteImportRule).toHaveBeenCalledWith("token", "rule-1");
    });
  });

  test("creates income import rules with income categories", async () => {
    const user = userEvent.setup();
    mocks.createImportRule.mockResolvedValue({ id: "rule-2" });

    render(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: /^Rules/ }));

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

    await user.click(screen.getByRole("button", { name: /^Rules/ }));

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

    await user.click(screen.getByRole("button", { name: /^Rules/ }));

    await user.type(screen.getByLabelText("Rule name"), "Coffee");
    await user.type(screen.getByLabelText("Match text"), "Cafe");
    await user.click(screen.getByRole("button", { name: "Add rule" }));

    expect(await screen.findByText("Rule name already exists.")).toBeInTheDocument();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  test("creates personal access tokens from security settings", async () => {
    const user = userEvent.setup();

    render(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "Security" }));
    await user.type(screen.getByPlaceholderText("Token name"), "CLI token");
    await user.click(screen.getByRole("button", { name: "Create token" }));

    await waitFor(() => {
      expect(mocks.createPersonalAccessToken).toHaveBeenCalledWith("token", "CLI token");
    });
    expect(await screen.findByText("ledgerra_pat_test")).toBeInTheDocument();
  });

  test("shows personal access token creation errors", async () => {
    const user = userEvent.setup();
    mocks.createPersonalAccessToken.mockRejectedValue(new Error("Request failed with status 500"));

    render(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "Security" }));
    await user.type(screen.getByPlaceholderText("Token name"), "CLI token");
    await user.click(screen.getByRole("button", { name: "Create token" }));

    expect(await screen.findByText("Request failed with status 500")).toBeInTheDocument();
  });

  test("removes revoked personal access tokens from the list", async () => {
    const user = userEvent.setup();
    mocks.getPersonalAccessTokens
      .mockResolvedValueOnce([
        {
          id: "pat-1",
          name: "CLI token",
          tokenPrefix: "ABC123",
          createdAtUtc: "2026-05-09T10:00:00Z",
          lastUsedAtUtc: null,
          revokedAtUtc: null
        }
      ])
      .mockResolvedValueOnce([
        {
          id: "pat-1",
          name: "CLI token",
          tokenPrefix: "ABC123",
          createdAtUtc: "2026-05-09T10:00:00Z",
          lastUsedAtUtc: null,
          revokedAtUtc: "2026-05-09T10:01:00Z"
        }
      ]);

    render(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "Security" }));
    expect(await screen.findByText("CLI token")).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: "Revoke CLI token" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Token actions for CLI token" }));
    await user.click(screen.getByRole("button", { name: "Revoke CLI token" }));

    await waitFor(() => {
      expect(mocks.revokePersonalAccessToken).toHaveBeenCalledWith("token", "pat-1");
    });
    await waitFor(() => {
      expect(screen.queryByText("CLI token")).not.toBeInTheDocument();
    });
  });

  test("changes the default provider through the settings form", async () => {
    const user = userEvent.setup();
    mocks.aiSettings.providers.anthropic = { isConfigured: true, maskedKey: "...cdef" };
    mocks.updateDefaultAiProvider.mockResolvedValue(mocks.aiSettings);

    const { rerender } = render(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: /^AI/ }));

    await user.selectOptions(screen.getByLabelText("Default provider"), "Anthropic");
    await user.click(screen.getByRole("button", { name: "Save AI settings" }));

    await waitFor(() => {
      expect(mocks.updateDefaultAiProvider).toHaveBeenCalledWith("token", "Anthropic");
    });

    mocks.aiSettings.defaultProvider = "Anthropic";
    rerender(<SettingsPage />);

    expect(screen.getByLabelText("Default provider")).toHaveValue("Anthropic");
  });

  test("clears account data and deletes the account from danger zone", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "Danger Zone" }));

    expect(screen.getByRole("heading", { name: "Danger Zone" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear all data" }));

    await waitFor(() => {
      expect(mocks.clearAccountData).toHaveBeenCalledWith("token");
    });
    expect(mocks.refresh).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Delete account" }));

    await waitFor(() => {
      expect(mocks.deleteAccount).toHaveBeenCalledWith("token");
    });
    expect(mocks.logout).toHaveBeenCalledTimes(1);
  });

  test("does not run danger zone actions when confirmation is cancelled", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "Danger Zone" }));
    await user.click(screen.getByRole("button", { name: "Clear all data" }));
    await user.click(screen.getByRole("button", { name: "Delete account" }));

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledTimes(2);
    });
    expect(mocks.clearAccountData).not.toHaveBeenCalled();
    expect(mocks.deleteAccount).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.logout).not.toHaveBeenCalled();
  });

  test("disables danger zone actions while one is running", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    let resolveClearAccountData: () => void = () => undefined;
    mocks.clearAccountData.mockReturnValue(new Promise<void>((resolve) => {
      resolveClearAccountData = resolve;
    }));

    render(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "Danger Zone" }));
    const clearButton = screen.getByRole("button", { name: "Clear all data" });
    const deleteButton = screen.getByRole("button", { name: "Delete account" });

    await user.click(clearButton);

    expect(clearButton).toBeDisabled();
    expect(deleteButton).toBeDisabled();

    await user.click(clearButton);
    expect(mocks.clearAccountData).toHaveBeenCalledTimes(1);

    resolveClearAccountData();
    await waitFor(() => {
      expect(clearButton).toBeEnabled();
    });
  });
});
