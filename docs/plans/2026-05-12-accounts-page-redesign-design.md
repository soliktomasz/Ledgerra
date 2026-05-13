# Accounts page redesign — design

Date: 2026-05-12
Branch: `account-page-redesign`
Reference: Claude Design screenshot (three-pane layout with net-worth, grouped account list, and per-account detail with KPIs + balance chart + recent operations).

## Goal

Replace the current two-card "Create / Current accounts" `AccountsPage` with a three-pane layout that matches the supplied design: a grouped, searchable account list with a net-worth summary on the left, and a rich account-detail view on the right showing institution/IBAN metadata, KPI cards, a balance-over-time chart, and recent operations.

This includes additive backend changes so that institution name, masked account number, icon kind, and a new `Investment` account type are first-class persisted fields.

## Scope

### In scope

- New domain fields on `Account`: `InstitutionName`, `AccountNumberMasked`, `IconKind`.
- New `Investment` value on `AccountType` enum.
- Additive Postgres migration via existing `CategorizationRuleSchemaInitializer`-style initializer.
- API contract additions (DTOs + create/update endpoints accept the new fields; GET returns them).
- Full rewrite of `frontend/src/pages/AccountsPage.tsx` to the three-pane layout.
- Two new modals (Create account / Edit account) reusing one shared form component.
- Route param: `/accounts/:accountId?` for selection persistence.
- Mobile layout (≤900px): single column with list-then-detail navigation.
- Translations (pl/en) for all new labels.
- Tests: backend API test for new fields round-trip; frontend rendering test for grouped list and KPI math.

### Out of scope

- Real bank linking / Plaid-style integrations. `AccountNumberMasked` is a free-form string entered by the user.
- IBAN validation / formatting beyond display-as-stored.
- New Transfer UI — "Transfer" button just navigates to `/transactions?accountId=…&form=transfer` and lets the existing collapsible form handle it.
- Balance snapshots / server-side chart endpoint. Chart is computed client-side from already-loaded transactions.
- Multi-currency net-worth conversion. Net-worth in the header sums balances using the user's preferred currency only when all accounts share it; otherwise renders "—" with a tooltip explaining mixed currencies. (Decision deferred to a follow-up; see "Open questions".)
- "Wartość netto" delta line (`+ 820,30 zł` under net worth in screenshot) — render only if all accounts share preferred currency; otherwise omit.

## Data model

### Backend — `Account` (additive)

```csharp
public sealed class Account
{
    // existing fields unchanged …
    public string? InstitutionName { get; set; }            // max 120
    public string? AccountNumberMasked { get; set; }        // max 64, free-form
    public AccountIconKind IconKind { get; set; } = AccountIconKind.Bank;
}

public enum AccountIconKind
{
    Bank = 1,
    Piggy = 2,
    Card = 3,
    Cash = 4,
    Chart = 5,
    Users = 6
}

public enum AccountType
{
    Checking = 1, Savings = 2, Cash = 3, Credit = 4, Joint = 5,
    Investment = 6 // NEW
}
```

EF mapping additions in `LedgerraDbContext.OnModelCreating`:

```csharp
builder.Property(a => a.InstitutionName).HasMaxLength(120);
builder.Property(a => a.AccountNumberMasked).HasMaxLength(64);
builder.Property(a => a.IconKind).HasConversion<int>();
```

### Schema migration (Postgres)

Extend the existing `CategorizationRuleSchemaInitializer` (or add a sibling `AccountSchemaInitializer` for clarity — recommended) with:

```sql
ALTER TABLE "Accounts" ADD COLUMN IF NOT EXISTS "InstitutionName" varchar(120) NULL;
ALTER TABLE "Accounts" ADD COLUMN IF NOT EXISTS "AccountNumberMasked" varchar(64) NULL;
ALTER TABLE "Accounts" ADD COLUMN IF NOT EXISTS "IconKind" integer NOT NULL DEFAULT 1;
```

SQLite dev path: `EnsureCreatedAsync` recreates only on empty DB; for existing dev DBs document a one-line manual fix or accept that users delete `app.db`. Acceptable per existing project conventions.

### Frontend `Account` type

```ts
export type AccountIconKind = "Bank" | "Piggy" | "Card" | "Cash" | "Chart" | "Users";
export type Account = {
  // existing …
  institutionName?: string | null;
  accountNumberMasked?: string | null;
  iconKind: AccountIconKind;
};
```

API client `createAccount` / `updateAccount` payloads pick the new fields.

## API

- `GET /api/accounts` → returns new fields.
- `POST /api/accounts` → accepts new fields; `IconKind` defaults to `Bank`.
- `PUT /api/accounts/{id}` → accepts new fields.
- No new endpoints. `accountTransactions` already available via existing transactions list with `accountId` filter.

## UI architecture

### Route

- `/accounts` → redirects to `/accounts/:firstAccountId` (or shows empty state if no accounts).
- `/accounts/:accountId` → renders the three-pane layout with that account selected.
- Selection navigation uses `useNavigate` so the URL stays in sync.

### Component tree

```text
AccountsPage
├── AccountListColumn
│   ├── NetWorthCard          (net worth + Dodaj button)
│   ├── AccountSearchInput
│   └── AccountGroup × N      (one per account type)
│       └── AccountListRow × M
└── AccountDetailColumn
    ├── AccountDetailHeader   (icon, breadcrumb, name, IBAN, Edytuj/Transfer)
    ├── AccountKpiGrid        (4 metric cards)
    ├── AccountBalanceChart   (recharts area/line + range tabs)
    └── AccountRecentOpsList  (5 rows + Zobacz wszystkie link)

CreateAccountModal / EditAccountModal share AccountForm (new component).
```

### Grouping

Group order matches screenshot:

1. Checking → "Konto bieżące"
2. Savings → "Oszczędności"
3. Credit → "Karta"
4. Cash → "Gotówka"
5. Investment → "Inwestycje"
6. Joint → "Wspólne"

Empty groups are hidden. Each group header shows the sum of its accounts' balances (same currency only; mixed → "—").

### Search

Client-side filter on `name + institutionName + accountNumberMasked` (case-insensitive). When active, groups with no matches are hidden.

### KPI cards

| Card | Computation |
|---|---|
| Saldo bieżące | `account.currentBalance` |
| Zmiana w tygodniu | Sum of signed transaction amounts for this account where `occurredOnUtc >= today − 7d` |
| Wpływy w *[selected month]* | Sum of `Income + TransferIn` for this account in selected month |
| Wydatki w *[selected month]* | Sum of `Expense + TransferOut` for this account in selected month |

Selected month comes from the existing global `MonthContext`. Card subtitle shows count (`"31 transakcji"`).

### Balance over time chart

- Computed client-side: starting from `currentBalance`, walk transactions backward in time to derive daily-end balances. Forward-fill days with no transactions.
- Range tabs: 1 mies. / 3 mies. (default) / 1 rok / Wszystko.
- Single-series area chart (recharts `<AreaChart>`), using accent color.
- Y-axis hidden; tooltip shows date + balance.

### Recent operations

- Last 5 transactions for this account, sorted by `occurredOnUtc` desc.
- Each row: category-colored icon, label (note or category name), category · type · `DD.MM`, signed amount.
- "Zobacz wszystkie →" links to `/transactions?accountId={id}`.

### Mobile (≤900px)

- `AccountListColumn` and `AccountDetailColumn` become single-column flows.
- `/accounts` (no id) shows list only; clicking a row navigates to `/accounts/:id` which shows detail with a back chevron in the header.
- KPI grid collapses to 2×2.

## Interactions

- **Dodaj** → `CreateAccountModal`. Fields: name (req), type (req, dropdown of 6), institutionName, accountNumberMasked, iconKind (dropdown with icon previews), currencyCode, openingBalance.
- **Edytuj** → `EditAccountModal`. Same fields prefilled + `isActive` toggle. Cancel/Save buttons; Save calls existing `updateAccount`.
- **Transfer** → `navigate('/transactions?accountId=' + id + '&form=transfer')`. `TransactionsPage` reads the new `form=transfer` param to open the collapsible form in Transfer mode with source preset.

## Styling

- Reuse existing dark-theme tokens from `styles.css`. Add a new section `/* accounts-redesign */` with:
  - `.accounts-shell` (grid: `360px 1fr`, gap 24).
  - `.account-list-column`, `.account-detail-column`.
  - `.net-worth-card`, `.account-group`, `.account-row` (with hover/active states).
  - `.account-icon` size variants (sm in list, lg in header) — solid-fill rounded square with white glyph, color from `iconKind`.
  - `.kpi-grid`, `.kpi-card`.
  - `.balance-chart-card` with `.range-tabs`.
  - `.recent-ops-list`.
- Spacing/typography mirrors the existing transactions redesign for consistency.

## Translations

Add new keys under `accounts.*`:

- `accounts.netWorth`
- `accounts.searchPlaceholder`
- `accounts.add`
- `accounts.edit`
- `accounts.transfer`
- `accounts.group.checking|savings|credit|cash|investment|joint`
- `accounts.kpi.balance|weekChange|monthIncome|monthExpenses`
- `accounts.kpi.afterLastTransaction|sevenDays|transactionsCount`
- `accounts.balanceOverTime`
- `accounts.range.month|threeMonths|year|all`
- `accounts.recentOps|seeAll`
- `accounts.form.institutionName|accountNumberMasked|iconKind|active`
- `accountType.Investment`

## Testing

- **Backend**: extend `ApiWorkflowTests` (or add `AccountFieldsTests`) — create account with all new fields, read back, update institution + iconKind, assert round-trip.
- **Frontend**:
  - Unit test for `groupAccountsByType` and `computeBalanceSeries` utilities.
  - Component test for `AccountsPage` rendering grouped list, selecting an account via click, opening Create modal, and KPI math against fixture transactions.
- Run full `npm test` and `dotnet test`.

## Manual verification

- `npm run dev` + log in with a seeded account: verify list groups, search filter, switching accounts via click and URL, Create modal saves and appears in correct group, Edit modal updates and reflects in detail header, Transfer button navigates correctly, chart renders for each range tab, mobile viewport switches to single-column.

## Open questions / deferred

- **Mixed-currency net worth** — current design renders "—" if accounts span multiple currencies. Real FX conversion is a follow-up.
- **Account icon picker UX** — design uses a simple `<select>` of named icons. A visual icon-grid picker can be a follow-up if desired.
- **Reordering** account groups or in-group rows — out of scope; alphabetical by name within group.

## File-touch summary

Backend:

- `backend/src/Ledgerra.Domain/Accounts/Account.cs`
- `backend/src/Ledgerra.Domain/Accounts/AccountType.cs`
- `backend/src/Ledgerra.Domain/Accounts/AccountIconKind.cs` (new)
- `backend/src/Ledgerra.Infrastructure/Persistence/LedgerraDbContext.cs`
- `backend/src/Ledgerra.Infrastructure/Persistence/AccountSchemaInitializer.cs` (new)
- `backend/src/Ledgerra.Api/Program.cs` (wire initializer)
- `backend/src/Ledgerra.Api/Accounts/*Dto.cs`, `AccountsController.cs` (or wherever DTOs live — TBD during implementation)
- `backend/tests/Ledgerra.Api.Tests/...` (test additions)

Frontend:

- `frontend/src/types.ts`
- `frontend/src/api/client.ts`
- `frontend/src/pages/AccountsPage.tsx` (rewrite)
- `frontend/src/pages/AccountsPage.test.tsx` (new)
- `frontend/src/components/AccountForm.tsx` (new)
- `frontend/src/components/AccountFormModal.tsx` (new)
- `frontend/src/components/AccountListColumn.tsx` (new)
- `frontend/src/components/AccountDetailColumn.tsx` (new)
- `frontend/src/components/AccountBalanceChart.tsx` (new)
- `frontend/src/utils/accounts.ts` (grouping + balance-series helpers, new)
- `frontend/src/state/I18n*.ts` (translations)
- `frontend/src/styles.css` (new section)
- `frontend/src/App.tsx` (route `/accounts/:accountId?`)
- `frontend/src/pages/TransactionsPage.tsx` (read `form=transfer` query param)
