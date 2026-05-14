import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { CategoriesPage } from "./CategoriesPage";

const mocks = vi.hoisted(() => ({
  languageCode: "en",
  refresh: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  createObjectURL: vi.fn(),
  revokeObjectURL: vi.fn(),
  exportedBlobs: [] as Blob[]
}));

const translations: Record<string, string> = {
  "categories.eyebrow": "Categories",
  "categories.title": "The language of your money",
  "categories.description": "Fewer categories make reports easier to read.",
  "transactionType.Expense": "Expense",
  "transactionType.Income": "Income",
  "common.loading": "Loading..."
};

function readBlobText(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

vi.mock("../state/AuthContext", () => ({
  useAuth: () => ({ auth: { accessToken: "token", email: "owner@ledgerra.local" } })
}));

vi.mock("../state/I18nContext", () => ({
  useI18n: () => ({
    languageCode: mocks.languageCode,
    setLanguageCode: vi.fn(),
    t: (key: string) => translations[key] ?? key
  })
}));

vi.mock("../api/client", () => ({
  apiClient: {
    createCategory: mocks.createCategory,
    updateCategory: mocks.updateCategory,
    deleteCategory: mocks.deleteCategory
  }
}));

vi.mock("../hooks/useLedgerraData", () => ({
  useLedgerraData: () => ({
    categories: [
      { id: "category-formula", name: "=SUM(1,1)", kind: "Expense", color: "#34d9a8", isSystem: false },
      { id: "category-groceries", name: "Groceries", kind: "Expense", color: "#73b8f2", isSystem: false },
      { id: "category-rent", name: "Rent", kind: "Expense", color: "#a7b8ff", isSystem: false }
    ],
    transactions: [
      {
        id: "transaction-rent",
        accountId: "account-1",
        categoryId: "category-rent",
        amount: -1200,
        type: "Expense",
        occurredOnUtc: "2026-05-05T10:00:00Z"
      }
    ],
    budget: { totalPlanned: 0, totalSpent: 0, totalRemaining: 0, categories: [] },
    importRules: [],
    profile: { email: "owner@ledgerra.local", preferredCurrencyCode: "USD", preferredLanguageCode: "en" },
    selectedMonth: "2026-05",
    loading: false,
    error: null,
    refresh: mocks.refresh
  })
}));

describe("CategoriesPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.localStorage.clear();
    mocks.languageCode = "en";
    mocks.exportedBlobs = [];
    mocks.createObjectURL.mockImplementation((blob: Blob) => {
      mocks.exportedBlobs.push(blob);
      return "blob:categories";
    });
    Object.defineProperty(HTMLAnchorElement.prototype, "click", {
      configurable: true,
      value: vi.fn()
    });
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: mocks.createObjectURL,
      revokeObjectURL: mocks.revokeObjectURL
    });
  });

  test("uses the available primary locale copy for regional language codes", () => {
    mocks.languageCode = "PL-pl";

    render(<CategoriesPage />);

    expect(screen.getByLabelText("Wszystkich kategorii")).toBeInTheDocument();
  });

  test("gives icon-only row actions explicit accessible names", () => {
    render(<CategoriesPage />);

    expect(screen.getByRole("button", { name: "Edit Groceries" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Duplicate Groceries" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive Groceries" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive unavailable for Rent" })).toBeDisabled();
  });

  test("neutralizes dangerous CSV values before exporting categories", async () => {
    const user = userEvent.setup();

    render(<CategoriesPage />);

    await user.click(screen.getByRole("button", { name: "Export" }));

    expect(mocks.exportedBlobs).toHaveLength(1);
    await expect(readBlobText(mocks.exportedBlobs[0])).resolves.toContain("\"'=SUM(1,1)\"");
  });
});
