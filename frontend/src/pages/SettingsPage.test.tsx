import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { SettingsPage } from "./SettingsPage";

vi.mock("../state/AuthContext", () => ({
  useAuth: () => ({ auth: { accessToken: "token", email: "owner@ledgerra.local" } })
}));

vi.mock("../hooks/useLedgerraData", () => ({
  useLedgerraData: () => ({
    profile: { email: "owner@ledgerra.local", preferredCurrencyCode: "USD" },
    aiSettings: {
      providers: {
        openAi: { isConfigured: true, maskedKey: "...3456" },
        anthropic: { isConfigured: false, maskedKey: null }
      },
      defaultProvider: "OpenAi"
    },
    refresh: vi.fn()
  })
}));

describe("SettingsPage", () => {
  test("shows AI provider configuration state", () => {
    render(<SettingsPage />);

    expect(screen.getByText("AI providers")).toBeInTheDocument();
    expect(screen.getByText("...3456")).toBeInTheDocument();
    expect(screen.getAllByText("Not configured").length).toBeGreaterThan(0);
  });
});
