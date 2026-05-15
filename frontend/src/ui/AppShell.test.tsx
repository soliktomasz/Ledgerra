import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AppShell } from "./AppShell";

vi.mock("../state/AuthContext", () => ({
  useAuth: () => ({
    auth: { email: "owner@ledgerra.local" },
    logout: vi.fn()
  })
}));

vi.mock("../state/I18nContext", () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}));

vi.mock("../state/MonthContext", () => ({
  useMonthSelection: () => ({
    selectedMonth: "2026-05",
    setSelectedMonth: vi.fn(),
    goToPreviousMonth: vi.fn(),
    goToNextMonth: vi.fn(),
    goToCurrentMonth: vi.fn()
  })
}));

describe("AppShell", () => {
  beforeEach(() => {
    cleanup();
  });

  test("uses a flush content canvas on the settings route", () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <AppShell>
          <div>Settings content</div>
        </AppShell>
      </MemoryRouter>
    );

    expect(screen.getByRole("main")).toHaveClass("content--settings");
  });

  test("keeps the standard padded canvas on workspace routes", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppShell>
          <div>Dashboard content</div>
        </AppShell>
      </MemoryRouter>
    );

    expect(screen.getByRole("main")).not.toHaveClass("content--settings");
  });
});
