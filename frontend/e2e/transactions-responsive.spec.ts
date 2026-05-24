import { expect, test } from "@playwright/test";

const authPayload = {
  userId: "user-responsive",
  login: "responsive",
  email: "responsive@ledgerra.local",
  accessToken: "token",
  refreshToken: "refresh",
  expiresAtUtc: "2099-01-01T00:00:00Z"
};

const accounts = [
  {
    id: "account-1",
    name: "Erste Platinum Checking",
    type: "Checking",
    currencyCode: "PLN",
    openingBalance: 0,
    currentBalance: 566.27,
    isActive: true,
    iconKind: "Bank"
  }
];

const categories = [
  { id: "category-1", name: "Utilities", kind: "Expense", color: "#60a5fa", isSystem: false },
  { id: "category-2", name: "Salary", kind: "Income", color: "#34d399", isSystem: false }
];

const transactions = [
  {
    id: "transaction-1",
    accountId: "account-1",
    categoryId: "category-1",
    amount: 222.14,
    type: "Expense",
    occurredOnUtc: "2026-05-08T12:00:00Z",
    note: "PRZELEW NA RACHUNEK ZA MEDIA"
  },
  {
    id: "transaction-2",
    accountId: "account-1",
    categoryId: "category-2",
    amount: 22707.34,
    type: "Income",
    occurredOnUtc: "2026-05-07T12:00:00Z",
    note: "May salary"
  }
];

test("transactions page uses the compact layout in a narrow desktop window", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript((payload) => {
    window.localStorage.setItem("ledgerra.auth", JSON.stringify(payload));
  }, authPayload);

  await page.route("**/api/accounts", (route) => route.fulfill({ json: accounts }));
  await page.route("**/api/categories", (route) => route.fulfill({ json: categories }));
  await page.route("**/api/budgets/**", (route) =>
    route.fulfill({
      json: {
        totalPlanned: 0,
        totalSpent: 0,
        totalRemaining: 0,
        categories: []
      }
    })
  );
  await page.route("**/api/savings-goals", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/transactions**", (route) => route.fulfill({ json: transactions }));

  await page.goto("/transactions");
  await expect(page.getByRole("heading", { name: "Transaction ledger" })).toBeVisible();

  const workspaceColumns = await page.locator(".transaction-workspace").evaluate((element) => {
    return getComputedStyle(element).gridTemplateColumns.split(" ").length;
  });
  await expect(page.locator(".transaction-settings-panel")).toHaveCSS("position", "static");

  expect(workspaceColumns).toBe(1);
  await expect(page.getByLabel("Transaction PRZELEW NA RACHUNEK ZA MEDIA")).toBeVisible();
  await expect(page.getByText("Erste Platinum Checking")).toBeVisible();
  await expect(page.getByText("Expense")).toBeVisible();
});
