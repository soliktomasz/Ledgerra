import { cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AccountsPage } from "./AccountsPage";
import { MonthProvider } from "../state/MonthContext";
import type { Account, Category, Profile, Transaction } from "../types";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  accounts: [] as Account[],
  categories: [] as Category[],
  transactions: [] as Transaction[],
  profile: null as Profile | null
}));

vi.mock("../state/AuthContext", () => ({
  useAuth: () => ({ auth: { accessToken: "token" } })
}));

vi.mock("../api/client", () => ({
  apiClient: {}
}));

vi.mock("../hooks/useLedgerraData", () => ({
  useLedgerraData: () => ({
    accounts: mocks.accounts,
    categories: mocks.categories,
    transactions: mocks.transactions,
    profile: mocks.profile,
    refresh: mocks.refresh
  })
}));

function renderAccountsPage() {
  return render(
    <MemoryRouter initialEntries={["/accounts/acc-1"]}>
      <Routes>
        <Route path="/accounts/:accountId" element={
          <MonthProvider>
            <AccountsPage />
          </MonthProvider>
        } />
      </Routes>
    </MemoryRouter>
  );
}

describe("AccountsPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.localStorage.clear();
    mocks.refresh.mockResolvedValue(undefined);
    mocks.accounts = [
      {
        id: "acc-1",
        name: "mBank · Konto główne",
        type: "Checking",
        currencyCode: "PLN",
        openingBalance: 0,
        currentBalance: 18420.55,
        isActive: true,
        institutionName: "mBank",
        accountNumberMasked: "PL •• 8273 •• 4821",
        iconKind: "Bank"
      },
      {
        id: "acc-2",
        name: "mBank · eMax",
        type: "Savings",
        currencyCode: "PLN",
        openingBalance: 0,
        currentBalance: 42600,
        isActive: true,
        institutionName: "mBank",
        accountNumberMasked: "PL •• 7711",
        iconKind: "Piggy"
      }
    ];
    mocks.categories = [];
    mocks.transactions = [
      {
        id: "tx-1",
        accountId: "acc-1",
        amount: 142.3,
        type: "Expense",
        occurredOnUtc: "2026-05-09T00:00:00Z",
        note: "Biedronka",
        categoryId: null
      }
    ];
    mocks.profile = {
      email: "owner@ledgerra.local",
      preferredCurrencyCode: "PLN",
      preferredLanguageCode: "pl"
    };
  });

  test("renders accounts with net worth, KPI labels, and action buttons", () => {
    renderAccountsPage();

    // Both accounts visible (the selected account also appears in the detail header,
    // so the checking name renders in multiple places).
    expect(screen.getAllByText(/mBank · Konto główne/).length).toBeGreaterThan(0);
    expect(screen.getByText(/mBank · eMax/)).toBeInTheDocument();

    // Net worth sum: 18420.55 + 42600 = 61020.55. Locale-tolerant match.
    expect(screen.getByText(/61[\s,.  ]?020[,.]55/)).toBeInTheDocument();

    // KPI label appears in pl or en depending on default i18n language.
    expect(screen.getByText(/Saldo bieżące|Current balance/)).toBeInTheDocument();

    // Edit + Transfer buttons exist (pl or en).
    expect(
      screen.getByRole("button", { name: /^(Edytuj|Edit)$/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Transfer$/ })
    ).toBeInTheDocument();
  });
});
