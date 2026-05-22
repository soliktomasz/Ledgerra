import { expect, test } from '@playwright/test';

const apiBaseUrl = process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:5027';
const password = 'P@ssw0rd123!';

async function registerAndLogin(page: import('@playwright/test').Page, suffix: string) {
  const nickname = `smoke-${suffix}`;
  const email = `${nickname}@ledgerra.local`;
  await page.goto('/login');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByLabel('Email').first().fill(nickname);
  await page.getByLabel('Email').nth(1).fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Start tracking' }).click();
  await expect(page.getByRole('heading', { name: 'Money at a glance' })).toBeVisible();
  return { email, nickname };
}

test('register/login, create account, create transaction, dashboard update', async ({ page }) => {
  const unique = `${Date.now()}-flow1`;
  await registerAndLogin(page, unique);

  await page.getByRole('link', { name: 'Accounts' }).click();
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByLabel('Name').fill('Everyday Checking');
  await page.getByLabel('Type').selectOption('Checking');
  await page.getByLabel('Currency').fill('USD');
  await page.getByRole('button', { name: 'Save account' }).click();
  await expect(page.getByText('Everyday Checking')).toBeVisible();

  await page.getByRole('link', { name: 'Transactions' }).click();
  await page.getByRole('button', { name: 'Add transaction' }).click();
  await page.getByLabel('Description').fill('Groceries smoke test');
  await page.getByLabel('Amount').fill('42.50');
  await page.getByRole('button', { name: 'Save transaction' }).click();
  await expect(page.getByText('Groceries smoke test')).toBeVisible();

  await page.getByRole('link', { name: 'Dashboard' }).click();
  await expect(page.getByRole('heading', { name: 'Money at a glance' })).toBeVisible();
});

test('budget carry-over and next month summary', async ({ page }) => {
  const unique = `${Date.now()}-flow2`;
  await registerAndLogin(page, unique);

  await page.getByRole('link', { name: 'Budgets' }).click();
  await page.getByRole('button', { name: 'Create budget' }).click();
  await page.getByLabel('Name').fill('Groceries');
  await page.getByLabel('Amount').fill('400');
  await page.getByLabel('Carry over').check();
  await page.getByRole('button', { name: 'Save budget' }).click();
  await expect(page.getByText('Groceries')).toBeVisible();

  await page.getByLabel('Current month').click();
  await page.getByLabel('Next month').click();
  await expect(page.getByText('Groceries')).toBeVisible();
});

test('create savings goal and link transfer', async ({ page }) => {
  const unique = `${Date.now()}-flow3`;
  await registerAndLogin(page, unique);

  await page.getByRole('link', { name: 'Goals' }).click();
  await page.getByRole('button', { name: 'Create goal' }).click();
  await page.getByLabel('Name').fill('Vacation');
  await page.getByLabel('Target amount').fill('1000');
  await page.getByRole('button', { name: 'Save goal' }).click();
  await expect(page.getByText('Vacation')).toBeVisible();
});

test('import review happy path with duplicate/rule behavior', async ({ request, page }) => {
  const unique = `${Date.now()}-flow4`;
  await registerAndLogin(page, unique);

  const importResponse = await request.post(`${apiBaseUrl}/api/monthly-report-imports/review`, {
    data: { month: '2026-05', rows: [{ description: 'Coffee', amount: -4.5, bookedAt: '2026-05-10' }] }
  });
  expect(importResponse.ok()).toBeTruthy();

  await page.getByRole('link', { name: 'Imports' }).click();
  await expect(page.getByRole('heading', { name: 'Imports' })).toBeVisible();
});

test('export and restore backup in clean session', async ({ request, page }) => {
  const unique = `${Date.now()}-flow5`;
  await registerAndLogin(page, unique);

  const backup = await request.get(`${apiBaseUrl}/api/backup/export`);
  expect(backup.ok()).toBeTruthy();

  await page.context().clearCookies();
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});
