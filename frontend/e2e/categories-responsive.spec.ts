import { expect, test } from "@playwright/test";

const authPayload = {
  userId: "user-categories-responsive",
  login: "categories-responsive",
  email: "categories-responsive@ledgerra.local",
  accessToken: "token",
  refreshToken: "refresh",
  expiresAtUtc: "2099-01-01T00:00:00Z"
};

const categories = [
  { id: "category-utilities", name: "Utilities", kind: "Expense", color: "#60a5fa", isSystem: false },
  { id: "category-rent", name: "Rent", kind: "Expense", color: "#c790f5", isSystem: false },
  { id: "category-salary", name: "Salary", kind: "Income", color: "#34d399", isSystem: false }
];

const transactions = [
  {
    id: "transaction-utilities",
    accountId: "account-1",
    categoryId: "category-utilities",
    amount: -240.5,
    type: "Expense",
    occurredOnUtc: "2026-05-08T12:00:00Z",
    note: "Power bill"
  },
  {
    id: "transaction-salary",
    accountId: "account-1",
    categoryId: "category-salary",
    amount: 4800,
    type: "Income",
    occurredOnUtc: "2026-05-07T12:00:00Z",
    note: "Salary"
  }
];

test("categories page edits inline in a compact desktop window", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript((payload) => {
    window.localStorage.setItem("ledgerra.auth", JSON.stringify(payload));
  }, authPayload);

  await page.route("**/api/settings/profile", (route) =>
    route.fulfill({
      json: { email: "categories-responsive@ledgerra.local", preferredCurrencyCode: "PLN", preferredLanguageCode: "en" }
    })
  );
  await page.route("**/api/categories", (route) => route.fulfill({ json: categories }));
  await page.route("**/api/transactions**", (route) => route.fulfill({ json: transactions }));
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
  await page.route("**/api/import-rules", (route) => route.fulfill({ json: [] }));

  await page.goto("/categories");
  await expect(page.getByRole("heading", { name: "The language of your money" })).toBeVisible();

  const workspaceColumns = await page.locator(".category-workspace").evaluate((element) => {
    return getComputedStyle(element).gridTemplateColumns.split(" ").length;
  });

  expect(workspaceColumns).toBe(1);
  await expect(page.locator(".category-editor-panel")).toHaveCount(0);

  await page.getByRole("button", { name: "Edit Utilities" }).click();

  await expect(page.getByRole("form", { name: "Edit Utilities inline" })).toBeVisible();
  await expect(page.getByText("Utilities").first()).toBeVisible();
  await expect(page.getByText("PLN").first()).toBeVisible();
});
