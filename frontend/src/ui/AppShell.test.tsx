import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AppShell } from "./AppShell";

const mocks = vi.hoisted(() => ({
  auth: { email: "owner@ledgerra.local", login: "owner" } as { email?: string; login?: string },
  logout: vi.fn()
}));

vi.mock("../state/AuthContext", () => ({
  useAuth: () => ({
    auth: mocks.auth,
    logout: mocks.logout
  })
}));

vi.mock("../state/I18nContext", () => ({
  useI18n: () => ({
    languageCode: "en",
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
    mocks.auth = { email: "owner@ledgerra.local", login: "owner" };
    mocks.logout.mockClear();
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

  test("shows a readable selected month in the sidebar controls", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppShell>
          <div>Dashboard content</div>
        </AppShell>
      </MemoryRouter>
    );

    expect(screen.getByText("May 2026")).toBeInTheDocument();
  });

  test("shows the signed in account identity near sign out", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppShell>
          <div>Dashboard content</div>
        </AppShell>
      </MemoryRouter>
    );

    expect(screen.getByText("owner@ledgerra.local")).toBeInTheDocument();
  });

  test("falls back to login when the auth email is unavailable", () => {
    mocks.auth = { email: "", login: "owner" };

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppShell>
          <div>Dashboard content</div>
        </AppShell>
      </MemoryRouter>
    );

    expect(screen.getByText("owner")).toBeInTheDocument();
  });
});
