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
    updateDefaultAiProvider: mocks.updateDefaultAiProvider
  }
}));

vi.mock("../hooks/useLedgerraData", () => ({
  useLedgerraData: () => ({
    profile: { email: "owner@ledgerra.local", preferredCurrencyCode: "USD" },
    aiSettings: mocks.aiSettings,
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
