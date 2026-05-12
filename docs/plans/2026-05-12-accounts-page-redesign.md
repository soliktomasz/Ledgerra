# Accounts page redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current two-card Accounts page with the three-pane redesign from the Claude Design screenshot — grouped/searchable account list with net-worth header, and per-account detail with KPIs, balance-over-time chart, and recent operations. Add three new optional fields to `Account` (`InstitutionName`, `AccountNumberMasked`, `IconKind`) and a new `Investment` account type.

**Architecture:** Additive backend changes (new fields/enum, additive Postgres `ALTER TABLE IF NOT EXISTS` migration via a new `AccountSchemaInitializer`). Frontend: rewrite `AccountsPage.tsx` into composed columns/components, route `/accounts/:accountId?` for selection persistence, client-side balance series computed from already-loaded transactions, two modals share one `AccountForm` component.

**Tech Stack:** .NET 8 / EF Core (Postgres prod, SQLite dev), React 18 + react-router-dom 6 + recharts 3 + Vite, Vitest + Testing Library.

**Reference design doc:** [`docs/plans/2026-05-12-accounts-page-redesign-design.md`](2026-05-12-accounts-page-redesign-design.md)

**Working branch:** `account-page-redesign` (already checked out). Per `CLAUDE.md`: do NOT create worktrees; new isolation = new branch in this workspace only.

**Conventions:**

- Run from repo root unless stated. Backend tests: `dotnet test backend/Ledgerra.sln`. Frontend tests: `npm --prefix frontend test`.
- Frequent commits — one per task by default.
- Don't add comments unless the *why* is non-obvious. No defensive validation beyond what already exists.

---

## Phase 1 — Backend domain & schema

### Task 1: Add `AccountIconKind` enum and `Investment` to `AccountType`

**Files:**
- Create: `backend/src/Ledgerra.Domain/Accounts/AccountIconKind.cs`
- Modify: `backend/src/Ledgerra.Domain/Accounts/AccountType.cs`

**Step 1: Create `AccountIconKind`**

```csharp
namespace Ledgerra.Domain.Accounts;

public enum AccountIconKind
{
    Bank = 1,
    Piggy = 2,
    Card = 3,
    Cash = 4,
    Chart = 5,
    Users = 6
}
```

**Step 2: Add `Investment = 6` to `AccountType`**

Open `AccountType.cs`, add `Investment = 6,` as the last member (after `Joint = 5`).

**Step 3: Build to confirm domain compiles**

Run: `dotnet build backend/Ledgerra.sln`
Expected: build succeeds, no errors related to these files.

**Step 4: Commit**

```bash
git add backend/src/Ledgerra.Domain/Accounts/AccountIconKind.cs backend/src/Ledgerra.Domain/Accounts/AccountType.cs
git commit -m "Feat: Add AccountIconKind enum and Investment account type"
```

---

### Task 2: Add new fields to `Account` entity + EF mapping

**Files:**
- Modify: `backend/src/Ledgerra.Domain/Accounts/Account.cs`
- Modify: `backend/src/Ledgerra.Infrastructure/Persistence/LedgerraDbContext.cs` (Account entity block, ~line 60)

**Step 1: Add fields to `Account`**

Append after `public bool IsActive`:

```csharp
public string? InstitutionName { get; set; }

public string? AccountNumberMasked { get; set; }

public AccountIconKind IconKind { get; set; } = AccountIconKind.Bank;
```

**Step 2: Add EF mappings inside `modelBuilder.Entity<Account>(builder => …)`**

Add inside the existing block, after `builder.Property(account => account.CurrencyCode).HasMaxLength(3);`:

```csharp
builder.Property(account => account.InstitutionName).HasMaxLength(120);
builder.Property(account => account.AccountNumberMasked).HasMaxLength(64);
builder.Property(account => account.IconKind).HasConversion<int>();
```

**Step 3: Build**

Run: `dotnet build backend/Ledgerra.sln`
Expected: build succeeds.

**Step 4: Commit**

```bash
git add backend/src/Ledgerra.Domain/Accounts/Account.cs backend/src/Ledgerra.Infrastructure/Persistence/LedgerraDbContext.cs
git commit -m "Feat: Add institution, masked number, and icon kind to Account"
```

---

### Task 3: Add `AccountSchemaInitializer` for Postgres ALTER

**Files:**
- Create: `backend/src/Ledgerra.Infrastructure/Persistence/AccountSchemaInitializer.cs`
- Modify: `backend/src/Ledgerra.Api/Program.cs` (around line 184, after `CategorizationRuleSchemaInitializer.InitializeAsync`)

**Step 1: Create the initializer**

```csharp
using Microsoft.EntityFrameworkCore;

namespace Ledgerra.Infrastructure.Persistence;

public static class AccountSchemaInitializer
{
    private const string NpgsqlProviderName = "Npgsql.EntityFrameworkCore.PostgreSQL";

    public static async Task InitializeAsync(LedgerraDbContext dbContext, CancellationToken cancellationToken = default)
    {
        if (!dbContext.Database.IsRelational() ||
            dbContext.Database.ProviderName != NpgsqlProviderName)
        {
            return;
        }

        await dbContext.Database.ExecuteSqlRawAsync(
            """
            ALTER TABLE "Accounts" ADD COLUMN IF NOT EXISTS "InstitutionName" character varying(120) NULL;
            ALTER TABLE "Accounts" ADD COLUMN IF NOT EXISTS "AccountNumberMasked" character varying(64) NULL;
            ALTER TABLE "Accounts" ADD COLUMN IF NOT EXISTS "IconKind" integer NOT NULL DEFAULT 1;
            """,
            cancellationToken);
    }
}
```

**Step 2: Wire it in `Program.cs`**

Inside the `using (var scope = …)` block that contains `EnsureCreatedAsync`, add right after the `CategorizationRuleSchemaInitializer.InitializeAsync(dbContext);` line:

```csharp
await AccountSchemaInitializer.InitializeAsync(dbContext);
```

**Step 3: Build**

Run: `dotnet build backend/Ledgerra.sln`
Expected: build succeeds.

**Step 4: Commit**

```bash
git add backend/src/Ledgerra.Infrastructure/Persistence/AccountSchemaInitializer.cs backend/src/Ledgerra.Api/Program.cs
git commit -m "Feat: Add Account schema initializer for new optional columns"
```

---

### Task 4: Extend `AccountDetails`, commands, and `IAccountStore` for new fields

**Files:**
- Modify: `backend/src/Ledgerra.Application/Accounts/AccountUseCases.cs`
- Modify: `backend/src/Ledgerra.Infrastructure/Persistence/AccountStore.cs` (implementations)

**Step 1: Extend `AccountDetails` record**

```csharp
public sealed record AccountDetails(
    Guid Id,
    string Name,
    string Type,
    string CurrencyCode,
    decimal OpeningBalance,
    decimal CurrentBalance,
    bool IsActive,
    string? InstitutionName,
    string? AccountNumberMasked,
    string IconKind);
```

**Step 2: Extend `CreateAccountCommand` and `UpdateAccountCommand`**

```csharp
public sealed record CreateAccountCommand(
    Guid UserId,
    string Name,
    string Type,
    string CurrencyCode,
    decimal OpeningBalance,
    string? InstitutionName,
    string? AccountNumberMasked,
    string? IconKind);

public sealed record UpdateAccountCommand(
    Guid UserId,
    Guid AccountId,
    string Name,
    string Type,
    string CurrencyCode,
    decimal OpeningBalance,
    bool IsActive,
    string? InstitutionName,
    string? AccountNumberMasked,
    string? IconKind);
```

**Step 3: Extend `IAccountStore.UpdateAsync` signature**

```csharp
Task<Account?> UpdateAsync(
    Guid userId,
    Guid accountId,
    string name,
    AccountType type,
    string currencyCode,
    decimal openingBalance,
    bool isActive,
    string? institutionName,
    string? accountNumberMasked,
    AccountIconKind iconKind,
    CancellationToken cancellationToken);
```

**Step 4: Update `AccountMappings.MapAccount`**

```csharp
public static AccountDetails MapAccount(Account account)
{
    return new AccountDetails(
        account.Id,
        account.Name,
        account.Type.ToString(),
        account.CurrencyCode,
        account.OpeningBalance,
        account.CurrentBalance,                  // existing computed field
        account.IsActive,
        account.InstitutionName,
        account.AccountNumberMasked,
        account.IconKind.ToString());
}
```

(If `CurrentBalance` is computed elsewhere — preserve the existing flow; the only additions are the three new trailing parameters.)

**Step 5: Update handlers**

In `CreateAccountCommandHandler.HandleAsync` — when building the new `Account` entity, set:

```csharp
InstitutionName = command.InstitutionName,
AccountNumberMasked = command.AccountNumberMasked,
IconKind = Enum.TryParse<AccountIconKind>(command.IconKind, out var iconKind) ? iconKind : AccountIconKind.Bank,
```

In `UpdateAccountCommandHandler.HandleAsync` — pass the new fields to `UpdateAsync` (parse `IconKind` the same way; default to existing on parse failure or `Bank` if creating, but for update, fall back to `AccountIconKind.Bank` only if the input is null/empty — read current account's `IconKind` first if needed).

**Step 6: Update `AccountStore.UpdateAsync` implementation**

Set the three new properties on the loaded entity before `SaveChangesAsync`.

**Step 7: Build**

Run: `dotnet build backend/Ledgerra.sln`
Expected: build succeeds; any callers (`AccountsController`) will break — fixed in next task.

**Step 8: Commit**

```bash
git add backend/src/Ledgerra.Application/Accounts/AccountUseCases.cs backend/src/Ledgerra.Infrastructure/Persistence/AccountStore.cs
git commit -m "Feat: Thread new Account fields through application and persistence"
```

> NOTE: If the build fails in `AccountsController` (callers of the changed signatures), proceed to Task 5 without committing the broken state — combine Tasks 4 and 5 into one commit.

---

### Task 5: Update DTOs and `AccountsController`

**Files:**
- Modify: `backend/src/Ledgerra.Api/Contracts/AccountContracts.cs`
- Modify: `backend/src/Ledgerra.Api/Controllers/AccountsController.cs`
- Modify: `backend/src/Ledgerra.Api/Contracts/BackupContracts.cs` (if `BackupAccountResponse` needs the new fields — TBD; safest: leave unchanged for now to keep backup format stable)

**Step 1: Extend DTOs**

```csharp
public sealed class CreateAccountRequest
{
    [Required, MaxLength(120)] public string Name { get; init; } = string.Empty;
    [Required] public string Type { get; init; } = string.Empty;
    [Required, StringLength(3, MinimumLength = 3)] public string CurrencyCode { get; init; } = "USD";
    public decimal OpeningBalance { get; init; }
    [MaxLength(120)] public string? InstitutionName { get; init; }
    [MaxLength(64)] public string? AccountNumberMasked { get; init; }
    public string? IconKind { get; init; }
}

public sealed class UpdateAccountRequest
{
    [Required, MaxLength(120)] public string Name { get; init; } = string.Empty;
    [Required] public string Type { get; init; } = string.Empty;
    [Required, StringLength(3, MinimumLength = 3)] public string CurrencyCode { get; init; } = "USD";
    public decimal OpeningBalance { get; init; }
    public bool IsActive { get; init; }
    [MaxLength(120)] public string? InstitutionName { get; init; }
    [MaxLength(64)] public string? AccountNumberMasked { get; init; }
    public string? IconKind { get; init; }
}

public sealed record AccountResponse(
    Guid Id,
    string Name,
    string Type,
    string CurrencyCode,
    decimal OpeningBalance,
    decimal CurrentBalance,
    bool IsActive,
    string? InstitutionName,
    string? AccountNumberMasked,
    string IconKind);
```

**Step 2: Update `AccountsController.Create` and `Update` to pass new fields**

Update the `CreateAccountCommand` and `UpdateAccountCommand` construction to include `request.InstitutionName, request.AccountNumberMasked, request.IconKind`.

**Step 3: Update `MapAccount` private method**

```csharp
private static AccountResponse MapAccount(AccountDetails account)
{
    return new AccountResponse(
        account.Id, account.Name, account.Type, account.CurrencyCode,
        account.OpeningBalance, account.CurrentBalance, account.IsActive,
        account.InstitutionName, account.AccountNumberMasked, account.IconKind);
}
```

**Step 4: Build**

Run: `dotnet build backend/Ledgerra.sln`
Expected: build succeeds.

**Step 5: Run existing tests**

Run: `dotnet test backend/Ledgerra.sln`
Expected: all existing tests pass. (Existing tests don't reference the new fields, so they should keep working.)

**Step 6: Commit**

```bash
git add backend/src/Ledgerra.Api/Contracts/AccountContracts.cs backend/src/Ledgerra.Api/Controllers/AccountsController.cs
git commit -m "Feat: Expose new Account fields via API contracts"
```

---

### Task 6: Backend round-trip test for new fields

**Files:**
- Modify: `backend/tests/Ledgerra.Api.Tests/ApiWorkflowTests.cs` (add a new test method) OR create `backend/tests/Ledgerra.Api.Tests/AccountFieldsTests.cs`

**Step 1: Write a failing test**

Add a test that:

1. Creates an account via POST with `InstitutionName="mBank"`, `AccountNumberMasked="PL •• 8273 •• 4821"`, `IconKind="Piggy"`, `Type="Investment"`.
2. GET /api/accounts/{id} → asserts all three fields and the new type round-trip.
3. PUT updates `InstitutionName="Revolut"`, `IconKind="Card"`.
4. GET again → asserts updates.

Follow the existing test fixture pattern in `ApiWorkflowTests` for auth/token setup.

**Step 2: Run the test — expect failure (or success if implementation is complete)**

Run: `dotnet test backend/Ledgerra.sln --filter FullyQualifiedName~AccountFields`
Expected: depending on order, this may already pass since impl is in place. If it fails for an unexpected reason, fix and re-run.

**Step 3: Run full backend test suite**

Run: `dotnet test backend/Ledgerra.sln`
Expected: all green.

**Step 4: Commit**

```bash
git add backend/tests/Ledgerra.Api.Tests/
git commit -m "Test: Round-trip new Account fields through API"
```

---

## Phase 2 — Frontend types & API

### Task 7: Update frontend `Account` type and API client

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/api/client.ts`

**Step 1: Extend `Account` type**

```ts
export type AccountIconKind = "Bank" | "Piggy" | "Card" | "Cash" | "Chart" | "Users";

export type Account = {
  id: string;
  name: string;
  type: string;
  currencyCode: string;
  openingBalance: number;
  currentBalance: number;
  isActive: boolean;
  institutionName?: string | null;
  accountNumberMasked?: string | null;
  iconKind: AccountIconKind;
};
```

**Step 2: Update `createAccount` and `updateAccount` typings**

```ts
createAccount(token: string, payload: Pick<Account,
  "name" | "type" | "currencyCode" | "openingBalance"
  | "institutionName" | "accountNumberMasked" | "iconKind">) {
  return request<Account>("/api/accounts", { method: "POST", token, body: payload });
}

updateAccount(token: string, account: Account) {
  return request<Account>(`/api/accounts/${account.id}`, {
    method: "PUT",
    token,
    body: {
      name: account.name,
      type: account.type,
      currencyCode: account.currencyCode,
      openingBalance: account.openingBalance,
      isActive: account.isActive,
      institutionName: account.institutionName ?? null,
      accountNumberMasked: account.accountNumberMasked ?? null,
      iconKind: account.iconKind
    }
  });
}
```

**Step 3: Type-check**

Run: `npm --prefix frontend run build`
Expected: succeeds. If type errors surface in `AccountsPage.tsx` (because `iconKind` is now required), that's expected — we're about to rewrite it.

**Step 4: Commit**

```bash
git add frontend/src/types.ts frontend/src/api/client.ts
git commit -m "Feat: Add new Account fields to frontend types and API client"
```

> If the build fails in `AccountsPage.tsx`, defer the commit until after Task 13 and reword the commit to include the page rewrite. Or temporarily make `iconKind` optional (`iconKind?`) here and tighten in Task 13.

---

## Phase 3 — Frontend utilities (TDD)

### Task 8: `groupAccountsByType` utility

**Files:**
- Create: `frontend/src/utils/accounts.ts`
- Create: `frontend/src/utils/accounts.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import type { Account } from "../types";
import { groupAccountsByType, ACCOUNT_GROUP_ORDER } from "./accounts";

function makeAccount(overrides: Partial<Account>): Account {
  return {
    id: overrides.id ?? "a",
    name: "X",
    type: "Checking",
    currencyCode: "PLN",
    openingBalance: 0,
    currentBalance: 0,
    isActive: true,
    iconKind: "Bank",
    ...overrides
  };
}

describe("groupAccountsByType", () => {
  it("orders groups Checking → Savings → Credit → Cash → Investment → Joint", () => {
    const accounts = [
      makeAccount({ id: "joint", type: "Joint" }),
      makeAccount({ id: "inv", type: "Investment" }),
      makeAccount({ id: "chk", type: "Checking" }),
      makeAccount({ id: "sav", type: "Savings" }),
      makeAccount({ id: "crd", type: "Credit" }),
      makeAccount({ id: "csh", type: "Cash" })
    ];

    const groups = groupAccountsByType(accounts);
    expect(groups.map((g) => g.type)).toEqual(ACCOUNT_GROUP_ORDER);
  });

  it("omits empty groups", () => {
    const groups = groupAccountsByType([makeAccount({ type: "Cash" })]);
    expect(groups.map((g) => g.type)).toEqual(["Cash"]);
  });

  it("computes group total balance and common currency", () => {
    const groups = groupAccountsByType([
      makeAccount({ id: "1", type: "Checking", currentBalance: 100, currencyCode: "PLN" }),
      makeAccount({ id: "2", type: "Checking", currentBalance: 50, currencyCode: "PLN" })
    ]);
    expect(groups[0].totalBalance).toBe(150);
    expect(groups[0].currencyCode).toBe("PLN");
  });

  it("returns null currency when group mixes currencies", () => {
    const groups = groupAccountsByType([
      makeAccount({ id: "1", type: "Checking", currencyCode: "PLN" }),
      makeAccount({ id: "2", type: "Checking", currencyCode: "EUR" })
    ]);
    expect(groups[0].currencyCode).toBeNull();
  });
});
```

**Step 2: Run test, confirm it fails**

Run: `npm --prefix frontend test -- utils/accounts.test.ts`
Expected: FAIL (module doesn't exist).

**Step 3: Implement**

```ts
import type { Account } from "../types";

export const ACCOUNT_GROUP_ORDER = [
  "Checking", "Savings", "Credit", "Cash", "Investment", "Joint"
] as const;

export type AccountGroupType = (typeof ACCOUNT_GROUP_ORDER)[number];

export type AccountGroup = {
  type: AccountGroupType;
  accounts: Account[];
  totalBalance: number;
  currencyCode: string | null;
};

export function groupAccountsByType(accounts: Account[]): AccountGroup[] {
  return ACCOUNT_GROUP_ORDER
    .map((type) => {
      const matches = accounts.filter((a) => a.type === type);
      if (matches.length === 0) {
        return null;
      }
      const totalBalance = matches.reduce((sum, a) => sum + a.currentBalance, 0);
      const currencies = new Set(matches.map((a) => a.currencyCode));
      const currencyCode = currencies.size === 1 ? matches[0].currencyCode : null;
      return { type, accounts: matches, totalBalance, currencyCode };
    })
    .filter((g): g is AccountGroup => g !== null);
}
```

**Step 4: Re-run test, confirm pass**

Run: `npm --prefix frontend test -- utils/accounts.test.ts`
Expected: 4 tests pass.

**Step 5: Commit**

```bash
git add frontend/src/utils/accounts.ts frontend/src/utils/accounts.test.ts
git commit -m "Feat: Add groupAccountsByType utility for accounts page"
```

---

### Task 9: `computeBalanceSeries` utility

**Files:**
- Modify: `frontend/src/utils/accounts.ts`
- Modify: `frontend/src/utils/accounts.test.ts`

**Step 1: Add failing tests**

```ts
import { computeBalanceSeries } from "./accounts";
import type { Transaction } from "../types";

function makeTransaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: overrides.id ?? "t",
    accountId: overrides.accountId ?? "a",
    amount: overrides.amount ?? 0,
    type: overrides.type ?? "Expense",
    occurredOnUtc: overrides.occurredOnUtc ?? "2026-05-10T00:00:00Z",
    note: null,
    ...overrides
  };
}

describe("computeBalanceSeries", () => {
  it("returns a single point when there are no transactions", () => {
    const series = computeBalanceSeries({
      currentBalance: 1000,
      transactions: [],
      rangeDays: 30,
      now: new Date("2026-05-12T00:00:00Z")
    });
    expect(series).toHaveLength(1);
    expect(series[0].balance).toBe(1000);
  });

  it("rolls back daily balances by signed transaction amounts", () => {
    const series = computeBalanceSeries({
      currentBalance: 1000,
      transactions: [
        makeTransaction({ amount: 200, type: "Income", occurredOnUtc: "2026-05-10T12:00:00Z" }),
        makeTransaction({ amount: 50, type: "Expense", occurredOnUtc: "2026-05-11T12:00:00Z" })
      ],
      rangeDays: 5,
      now: new Date("2026-05-12T00:00:00Z")
    });

    const lastPoint = series[series.length - 1];
    expect(lastPoint.balance).toBe(1000);
    const beforeMay10 = series.find((p) => p.date === "2026-05-09");
    expect(beforeMay10?.balance).toBe(850); // 1000 - 200(income added back) + 50(expense added back) → reverses to 850
  });
});
```

> NOTE: the exact expected values may need adjustment when running the test — write the test, run it, observe the actual value, then assert that value if it represents the correct behavior (signed deltas reversed). Verify reasoning before locking in numbers.

**Step 2: Run, confirm fail**

Run: `npm --prefix frontend test -- utils/accounts.test.ts`

**Step 3: Implement**

```ts
import type { Transaction } from "../types";

export type BalancePoint = { date: string; balance: number };

export function signedAmount(t: Transaction): number {
  if (t.type === "Expense" || t.type === "TransferOut") return -Math.abs(t.amount);
  if (t.type === "Income" || t.type === "TransferIn") return Math.abs(t.amount);
  return t.amount;
}

function toDateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function computeBalanceSeries(args: {
  currentBalance: number;
  transactions: Transaction[];
  rangeDays: number; // 0 = all
  now: Date;
}): BalancePoint[] {
  const { currentBalance, transactions, rangeDays, now } = args;
  const sorted = [...transactions].sort((a, b) => a.occurredOnUtc.localeCompare(b.occurredOnUtc));

  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (rangeDays > 0) start.setUTCDate(start.getUTCDate() - rangeDays);
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  // Walk forward from earliest known point, but the simplest: roll back current balance day-by-day.
  const txByDay = new Map<string, number>();
  for (const t of sorted) {
    const key = toDateKey(new Date(t.occurredOnUtc));
    txByDay.set(key, (txByDay.get(key) ?? 0) + signedAmount(t));
  }

  const points: BalancePoint[] = [];
  let balance = currentBalance;
  const cursor = new Date(end);

  while (cursor >= start) {
    const key = toDateKey(cursor);
    points.unshift({ date: key, balance });
    balance -= txByDay.get(key) ?? 0;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return points;
}
```

**Step 4: Run tests, fix expectations if needed**

Run: `npm --prefix frontend test -- utils/accounts.test.ts`
Expected: passing. If a numeric assertion is off but the math is right, adjust the assertion to match correct behavior.

**Step 5: Commit**

```bash
git add frontend/src/utils/accounts.ts frontend/src/utils/accounts.test.ts
git commit -m "Feat: Add computeBalanceSeries utility for account balance chart"
```

---

## Phase 4 — Frontend components

### Task 10: `AccountForm` shared form

**Files:**
- Create: `frontend/src/components/AccountForm.tsx`

**Step 1: Implement** a controlled-form component with this shape:

```ts
export type AccountFormValues = {
  name: string;
  type: string;
  currencyCode: string;
  openingBalance: string; // string so the <input> behaves
  institutionName: string;
  accountNumberMasked: string;
  iconKind: AccountIconKind;
  isActive?: boolean; // only shown in edit mode
};

export function AccountForm({
  mode,                // "create" | "edit"
  values,
  onChange,
  onSubmit,
  onCancel
}: {
  mode: "create" | "edit";
  values: AccountFormValues;
  onChange: (next: AccountFormValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  // … render labelled inputs for each field, a <select> for type with 6 options,
  // a <select> for iconKind, a <select> for currencyCode (use supportedCurrencies),
  // and an "isActive" checkbox when mode === "edit".
  // Submit button label: t(mode === "create" ? "accounts.addAccount" : "common.save").
}
```

Reuse existing label/input/button class names from `styles.css` (`stack-form`, `primary-button`, `ghost-button`). Translations come from `useI18n()`.

**Step 2: Build to confirm no type errors**

Run: `npm --prefix frontend run build`
Expected: succeeds (file may be unused, that's fine).

**Step 3: Commit**

```bash
git add frontend/src/components/AccountForm.tsx
git commit -m "Feat: Add shared AccountForm component"
```

---

### Task 11: `AccountFormModal` wrapper

**Files:**
- Create: `frontend/src/components/AccountFormModal.tsx`

**Step 1: Implement** a thin modal wrapper:

```tsx
export function AccountFormModal({
  open, mode, initialValues, onClose, onSaved
}: {
  open: boolean;
  mode: "create" | "edit";
  initialValues: AccountFormValues;
  onClose: () => void;
  onSaved: (account: Account) => void;
}) {
  // Local state seeded from initialValues. On submit, call apiClient.createAccount or updateAccount,
  // bubble errors via inline message at top of form. On success, onSaved(account) then onClose().
}
```

Use a simple overlay div + `role="dialog"` + Escape-to-close handler. No portal library — render with fixed positioning and `aria-modal`. Use class names `modal-overlay`, `modal-card` (CSS added in Task 17).

**Step 2: Build to confirm**

Run: `npm --prefix frontend run build`
Expected: succeeds.

**Step 3: Commit**

```bash
git add frontend/src/components/AccountFormModal.tsx
git commit -m "Feat: Add AccountFormModal for create and edit flows"
```

---

### Task 12: `AccountBalanceChart` component

**Files:**
- Create: `frontend/src/components/AccountBalanceChart.tsx`

**Step 1: Implement** using recharts:

```tsx
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { computeBalanceSeries } from "../utils/accounts";
import type { Account, Transaction } from "../types";

export type BalanceRange = "1m" | "3m" | "1y" | "all";

const RANGE_DAYS: Record<BalanceRange, number> = { "1m": 30, "3m": 90, "1y": 365, "all": 0 };

export function AccountBalanceChart({
  account, transactions, range, onRangeChange
}: {
  account: Account;
  transactions: Transaction[];
  range: BalanceRange;
  onRangeChange: (next: BalanceRange) => void;
}) {
  const data = computeBalanceSeries({
    currentBalance: account.currentBalance,
    transactions,
    rangeDays: RANGE_DAYS[range],
    now: new Date()
  });

  // Render: card title with range tabs (buttons), then ResponsiveContainer with AreaChart.
  // Hide Y-axis (YAxis hide), accent gradient fill, dataKey="balance".
}
```

**Step 2: Build**

Run: `npm --prefix frontend run build`
Expected: succeeds.

**Step 3: Commit**

```bash
git add frontend/src/components/AccountBalanceChart.tsx
git commit -m "Feat: Add AccountBalanceChart with range selector"
```

---

### Task 13: `AccountListColumn` (net worth + search + grouped list)

**Files:**
- Create: `frontend/src/components/AccountListColumn.tsx`

**Step 1: Implement** stateless component:

```tsx
export function AccountListColumn({
  accounts,
  selectedAccountId,
  searchQuery,
  onSearchQueryChange,
  onSelectAccount,
  onAddAccount
}: {
  accounts: Account[];
  selectedAccountId: string | null;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  onSelectAccount: (id: string) => void;
  onAddAccount: () => void;
}) {
  const filtered = useMemo(() => filterAccounts(accounts, searchQuery), [accounts, searchQuery]);
  const groups = useMemo(() => groupAccountsByType(filtered), [filtered]);

  const netWorth = useMemo(() => computeNetWorth(accounts), [accounts]);

  // Renders: .net-worth-card (with t("accounts.netWorth"), value, "+ Dodaj" button → onAddAccount)
  // .account-search-input
  // .account-group × N — each with group label, group total, then rows
}
```

Add `filterAccounts` and `computeNetWorth` helpers in `utils/accounts.ts` (with tests in `utils/accounts.test.ts`). `filterAccounts` matches `name + institutionName + accountNumberMasked` case-insensitively. `computeNetWorth` returns `{ value, currencyCode | null }`.

**Step 2: Add and run util tests for the two new helpers** (small, follow Task 8 pattern). Then build.

Run: `npm --prefix frontend test -- utils/accounts.test.ts && npm --prefix frontend run build`
Expected: tests + build succeed.

**Step 3: Commit**

```bash
git add frontend/src/components/AccountListColumn.tsx frontend/src/utils/accounts.ts frontend/src/utils/accounts.test.ts
git commit -m "Feat: Add AccountListColumn with grouped list, search, and net worth"
```

---

### Task 14: `AccountDetailColumn` (header + KPIs + chart + recent ops)

**Files:**
- Create: `frontend/src/components/AccountDetailColumn.tsx`

**Step 1: Implement** stateful component owning chart-range state:

```tsx
export function AccountDetailColumn({
  account,
  transactions,        // all transactions for this account
  categories,
  selectedMonth,       // "YYYY-MM" from MonthContext
  onEdit,
  onTransfer
}: {
  account: Account;
  transactions: Transaction[];
  categories: Category[];
  selectedMonth: string;
  onEdit: () => void;
  onTransfer: () => void;
}) {
  const [range, setRange] = useState<BalanceRange>("3m");

  const weekChange = computeWeekChange(transactions);
  const monthIncome = computeMonthInflows(transactions, selectedMonth);
  const monthExpenses = computeMonthOutflows(transactions, selectedMonth);
  const recentOps = transactions
    .slice()
    .sort((a, b) => b.occurredOnUtc.localeCompare(a.occurredOnUtc))
    .slice(0, 5);

  // Layout: .account-detail-header (icon, breadcrumb, name, masked number, Edit/Transfer)
  // .kpi-grid with 4 cards
  // <AccountBalanceChart …>
  // .recent-ops-list with "Zobacz wszystkie →" → /transactions?accountId={account.id}
}
```

Add helpers `computeWeekChange`, `computeMonthInflows`, `computeMonthOutflows` to `utils/accounts.ts` with corresponding tests (follow Task 8 pattern).

**Step 2: Run tests + build**

Run: `npm --prefix frontend test && npm --prefix frontend run build`
Expected: green.

**Step 3: Commit**

```bash
git add frontend/src/components/AccountDetailColumn.tsx frontend/src/utils/accounts.ts frontend/src/utils/accounts.test.ts
git commit -m "Feat: Add AccountDetailColumn with KPIs, chart, and recent operations"
```

---

## Phase 5 — Page rewrite & routing

### Task 15: Rewrite `AccountsPage.tsx`

**Files:**
- Modify: `frontend/src/pages/AccountsPage.tsx` (full rewrite — replace the 181 lines)

**Step 1: New page implementation**

```tsx
export function AccountsPage() {
  const { accountId: routeAccountId } = useParams<{ accountId?: string }>();
  const navigate = useNavigate();
  const { auth } = useAuth();
  const { t } = useI18n();
  const { selectedMonth } = useMonthSelection();
  const { accounts, categories, transactions, refresh } = useLedgerraData({
    accounts: true, categories: true, transactions: true
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === routeAccountId) ?? accounts[0] ?? null,
    [accounts, routeAccountId]
  );

  useEffect(() => {
    if (!routeAccountId && selectedAccount) {
      navigate(`/accounts/${selectedAccount.id}`, { replace: true });
    }
  }, [routeAccountId, selectedAccount, navigate]);

  const accountTransactions = useMemo(
    () => transactions.filter((t) => t.accountId === selectedAccount?.id),
    [transactions, selectedAccount?.id]
  );

  return (
    <div className="accounts-shell">
      <AccountListColumn
        accounts={accounts}
        selectedAccountId={selectedAccount?.id ?? null}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onSelectAccount={(id) => navigate(`/accounts/${id}`)}
        onAddAccount={() => setCreateOpen(true)}
      />
      {selectedAccount ? (
        <AccountDetailColumn
          account={selectedAccount}
          transactions={accountTransactions}
          categories={categories}
          selectedMonth={selectedMonth}
          onEdit={() => setEditOpen(true)}
          onTransfer={() => navigate(`/transactions?accountId=${selectedAccount.id}&form=transfer`)}
        />
      ) : (
        <EmptyState … />
      )}

      <AccountFormModal
        open={createOpen}
        mode="create"
        initialValues={defaultCreateValues(/* preferred currency */)}
        onClose={() => setCreateOpen(false)}
        onSaved={async (acc) => { await refresh(); navigate(`/accounts/${acc.id}`); }}
      />
      {selectedAccount && (
        <AccountFormModal
          open={editOpen}
          mode="edit"
          initialValues={accountToFormValues(selectedAccount)}
          onClose={() => setEditOpen(false)}
          onSaved={async () => { await refresh(); }}
        />
      )}
    </div>
  );
}
```

**Step 2: Type-check + build**

Run: `npm --prefix frontend run build`
Expected: succeeds.

**Step 3: Commit**

```bash
git add frontend/src/pages/AccountsPage.tsx
git commit -m "Refactor: Rewrite AccountsPage into three-pane redesign"
```

---

### Task 16: Add `/accounts/:accountId?` route

**Files:**
- Modify: `frontend/src/App.tsx`

**Step 1: Add a nested route**

Locate the existing `<Route path="/accounts" element={<AccountsPage />} />` and replace with:

```tsx
<Route path="/accounts" element={<AccountsPage />} />
<Route path="/accounts/:accountId" element={<AccountsPage />} />
```

**Step 2: Build**

Run: `npm --prefix frontend run build`
Expected: succeeds.

**Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "Feat: Route accounts page with optional accountId param"
```

---

### Task 17: Wire `form=transfer` query param in `TransactionsPage`

**Files:**
- Modify: `frontend/src/pages/TransactionsPage.tsx`

**Step 1:** Find the existing logic that reads URL query params (`initialQuery`) and the collapsible form's open state. Add:

```ts
const formParam = initialQuery.get("form");
// initialize form expanded + mode if formParam === "transfer"
```

Set the form's initial `formMode` to `"create"`, type filter to `"Transfer"`, and ensure the collapsible form is **opened** on mount when `formParam === "transfer"`. Pre-fill the form's source account from `accountId` param.

**Step 2:** Build + manual smoke.

Run: `npm --prefix frontend run build`
Expected: succeeds.

**Step 3:** Commit.

```bash
git add frontend/src/pages/TransactionsPage.tsx
git commit -m "Feat: Open transfer form when navigated from account detail"
```

---

## Phase 6 — Styles, i18n, polish

### Task 18: Add CSS for the redesign

**Files:**
- Modify: `frontend/src/styles.css` (append a new section at end)

**Step 1:** Append a section `/* === accounts page redesign === */` with classes:

- `.accounts-shell` — `display: grid; grid-template-columns: minmax(320px, 380px) 1fr; gap: 24px;` (match site spacing tokens)
- `.account-list-column`, `.account-detail-column`
- `.net-worth-card` — large numeric value, "+ Dodaj" pill button
- `.account-search-input` — magnifier icon + input
- `.account-group`, `.account-group-header` (uppercase label + right-aligned sum), `.account-group-body`
- `.account-row` — icon + name/subtitle + balance/change; hover and `.is-active` states
- `.account-icon` — circular tile, color variants `is-bank`, `is-piggy`, `is-card`, `is-cash`, `is-chart`, `is-users`
- `.account-detail-header` — icon (large), breadcrumb, big name (serif), masked number subline, action buttons aligned right
- `.kpi-grid` (4 columns, collapses to 2 below 1100px and to 1 below 700px)
- `.kpi-card` — uppercase label, large value, helper line
- `.balance-chart-card` — title row with `.range-tabs`
- `.range-tabs button` — pill toggle group, active variant
- `.recent-ops-card`, `.recent-ops-list`, `.recent-op-row` — icon + label/sub + signed amount
- `.modal-overlay`, `.modal-card`, `.modal-actions` — dialog styling

Media query `@media (max-width: 900px)` collapses `.accounts-shell` to single column.

**Step 2:** Run dev server and visually confirm.

Run: `npm --prefix frontend run dev` (background). Open `http://localhost:5173/accounts`. Compare against the design screenshot. Iterate on CSS.

Stop dev server.

**Step 3:** Commit.

```bash
git add frontend/src/styles.css
git commit -m "Style: Add accounts page redesign styles"
```

---

### Task 19: Add translations (pl + en)

**Files:**
- Modify: `frontend/src/state/I18nContext.tsx`

**Step 1:** Add to the English dictionary block (near line 105):

```
"accounts.netWorth": "Net worth",
"accounts.searchPlaceholder": "Search accounts…",
"accounts.add": "Add",
"accounts.edit": "Edit",
"accounts.transfer": "Transfer",
"accounts.group.checking": "Checking",
"accounts.group.savings": "Savings",
"accounts.group.credit": "Card",
"accounts.group.cash": "Cash",
"accounts.group.investment": "Investments",
"accounts.group.joint": "Joint",
"accounts.kpi.balance": "Current balance",
"accounts.kpi.weekChange": "Change this week",
"accounts.kpi.monthIncome": "Inflows in {month}",
"accounts.kpi.monthExpenses": "Outflows in {month}",
"accounts.kpi.afterLastTransaction": "After last transaction",
"accounts.kpi.sevenDays": "7 days",
"accounts.kpi.transactionsCount": "{count} transactions",
"accounts.balanceOverTime": "Balance over time",
"accounts.range.month": "1 mo.",
"accounts.range.threeMonths": "3 mo.",
"accounts.range.year": "1 yr",
"accounts.range.all": "All",
"accounts.recentOps": "Recent operations",
"accounts.seeAll": "See all →",
"accounts.form.institutionName": "Institution",
"accounts.form.accountNumberMasked": "Account number",
"accounts.form.iconKind": "Icon",
"accounts.form.active": "Active",
"accountType.Investment": "Investment",
```

**Step 2:** Add Polish equivalents to the `pl` block (near line 497):

```
"accounts.netWorth": "Wartość netto",
"accounts.searchPlaceholder": "Szukaj konta…",
"accounts.add": "Dodaj",
"accounts.edit": "Edytuj",
"accounts.transfer": "Transfer",
"accounts.group.checking": "Konto bieżące",
"accounts.group.savings": "Oszczędności",
"accounts.group.credit": "Karta",
"accounts.group.cash": "Gotówka",
"accounts.group.investment": "Inwestycje",
"accounts.group.joint": "Wspólne",
"accounts.kpi.balance": "Saldo bieżące",
"accounts.kpi.weekChange": "Zmiana w tygodniu",
"accounts.kpi.monthIncome": "Wpływy w {month}",
"accounts.kpi.monthExpenses": "Wydatki w {month}",
"accounts.kpi.afterLastTransaction": "Po ostatniej transakcji",
"accounts.kpi.sevenDays": "7 dni",
"accounts.kpi.transactionsCount": "{count} transakcji",
"accounts.balanceOverTime": "Saldo w czasie",
"accounts.range.month": "1 mies.",
"accounts.range.threeMonths": "3 mies.",
"accounts.range.year": "1 rok",
"accounts.range.all": "Wszystko",
"accounts.recentOps": "Ostatnie operacje",
"accounts.seeAll": "Zobacz wszystkie →",
"accounts.form.institutionName": "Bank / instytucja",
"accounts.form.accountNumberMasked": "Numer konta",
"accounts.form.iconKind": "Ikona",
"accounts.form.active": "Aktywne",
"accountType.Investment": "Inwestycyjne",
```

**Step 3:** Build + run dev server, switch language, confirm both render.

```bash
npm --prefix frontend run build
```

**Step 4:** Commit.

```bash
git add frontend/src/state/I18nContext.tsx
git commit -m "Feat: Add translations for accounts page redesign"
```

---

## Phase 7 — Final verification

### Task 20: AccountsPage component test

**Files:**
- Create: `frontend/src/pages/AccountsPage.test.tsx`

**Step 1:** Add a single rendering test that:

1. Renders `<AccountsPage>` inside the same wrappers used by other page tests (auth, i18n, month, router with `MemoryRouter` initialized at `/accounts/<id>`).
2. Provides fixture data via the existing `useLedgerraData` mock pattern (look at `DashboardPage.test.tsx` for the pattern).
3. Asserts: net-worth value renders, two account rows render in correct groups, KPI labels appear, "Edytuj" button is present.

Reference: `frontend/src/pages/DashboardPage.test.tsx` and `frontend/src/pages/TransactionsPage.test.tsx` for the mocking style.

**Step 2:** Run.

Run: `npm --prefix frontend test -- pages/AccountsPage.test.tsx`
Expected: pass.

**Step 3:** Commit.

```bash
git add frontend/src/pages/AccountsPage.test.tsx
git commit -m "Test: Add AccountsPage rendering test"
```

---

### Task 21: Full verification pass

**Step 1:** Backend full suite.

Run: `dotnet test backend/Ledgerra.sln`
Expected: all green.

**Step 2:** Frontend full suite.

Run: `npm --prefix frontend test`
Expected: all green.

**Step 3:** Production build.

Run: `npm --prefix frontend run build`
Expected: clean build, no TS errors.

**Step 4:** Manual UI verification (see `superpowers:verification-before-completion` skill):

1. `npm --prefix frontend run dev` and login.
2. Visit `/accounts` — confirm redirect to `/accounts/<firstId>`.
3. Confirm net-worth, groups, search, row click → URL changes, detail KPIs + chart + recent ops render.
4. "+ Dodaj" → modal opens → fill in fields incl. new ones → save → new account appears in correct group → URL updates to new id.
5. "Edytuj" on a real account → change institution + iconKind + isActive → save → header reflects changes.
6. "Transfer" → navigates to `/transactions?accountId=…&form=transfer` and transfer form is open with source preselected.
7. Resize to ~700px — list/detail collapses to single column; navigate works.
8. Switch language pl ↔ en — every label visible in the design comes through.
9. Refresh the DB-stored fields by reloading the page — values persist.

**Step 5:** If everything green, no commit needed (verification only). Otherwise, file follow-up tasks for issues.

---

## Done criteria

- `AccountsPage` matches the reference screenshot at parity for layout, grouping, KPIs, chart, recent ops, and modals (within reason for the existing color/typography tokens).
- New fields persist round-trip through Postgres prod (`ALTER TABLE` migration) and SQLite dev (via `EnsureCreated`).
- All tests (backend + frontend) pass.
- `dotnet build` and `npm run build` are clean.
- Polish + English translations cover every visible string.
- Manual smoke covers list, detail, search, create, edit, transfer-handoff, mobile, language switch.
