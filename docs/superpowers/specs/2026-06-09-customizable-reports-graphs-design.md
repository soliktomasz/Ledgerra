# Customizable Reports Graphs Design

## Goal

Improve the Reports page charts and let users choose which chart types appear on the board. The first release adds practical new charts without changing the backend reporting API.

## Scope

- Keep the existing report range and account filters.
- Keep the existing chart types: spending trend, income vs expense, category breakdown, net worth history.
- Add new chart types derived from `ReportingOverview`: savings rate trend, net cash flow trend, and income trend.
- Let users add and remove chart cards.
- Persist the chosen chart set in `localStorage` per browser.
- Preserve existing empty states and category drilldown links.

## Out Of Scope

- Server-side saved report layouts.
- Drag-and-drop chart ordering.
- Custom formulas or arbitrary metric builders.
- New backend endpoints.
- Merchant/payee analysis and account comparison charts.

## User Experience

Reports becomes a configurable chart board. A `Charts` control appears with the existing range and account controls. Opening it shows available chart types with checkboxes/toggles. Enabled charts render as cards in the board. Each chart card has a remove action, so users can hide a graph directly from the board.

When no charts are enabled, the board shows an empty state with an action to add charts. The default selection remains familiar: spending trend, income vs expense, category breakdown, and net worth history.

## Chart Types

- `spendingTrend`: monthly expense area/line chart.
- `incomeVsExpense`: grouped income and expense bars.
- `categoryBreakdown`: horizontal category expense bars with drilldown links.
- `netWorthHistory`: net worth line chart.
- `savingsRateTrend`: monthly savings rate line chart, calculated as `(income - expenses) / income * 100`; months with zero income use `0%`.
- `netCashFlowTrend`: monthly net cash flow area/line chart, using `incomeVsExpense.net`.
- `incomeTrend`: monthly income area/line chart.

## Architecture

`ReportsPage` owns chart selection state and maps chart definitions to rendered cards. The chart registry lives near the page so labels, icons, availability, and render functions stay explicit. Chart components stay in `frontend/src/ui/ReportCharts.tsx`, sharing a polished `ChartShell`, tooltip, axis behavior, and empty-state patterns.

Customization persistence uses a small localStorage helper inside the page. Invalid or stale chart ids are ignored, and an empty stored selection is respected so users may intentionally clear the board.

## Visual Design

Chart cards should feel more deliberate and less like generic boxed canvases:

- Use consistent chart heights and stable responsive grid tracks.
- Reduce heavy borders inside cards.
- Improve tooltip contrast and spacing.
- Keep axes quiet but readable.
- Use distinct semantic colors for income, expenses, net cash flow, savings rate, and net worth.
- Keep controls compact and work-focused.

## Data Flow

1. `useReportingOverview` fetches `ReportingOverview` and accounts.
2. `ReportsPage` derives:
   - `spendingPoints` from `monthlySpendingTrend`.
   - `netWorthPoints` from `netWorthHistory`.
   - `cashflowPoints` from `incomeVsExpense`.
   - `savingsRatePoints` from `incomeVsExpense`.
   - `incomeTrendPoints` from `incomeVsExpense`.
3. Enabled chart ids select which chart definitions render.
4. Changes to enabled chart ids write to localStorage.

## Error Handling

- Existing API errors and warnings stay unchanged.
- Invalid localStorage JSON falls back to default chart ids.
- Unknown chart ids are filtered out.
- Empty chart data uses existing report empty states.

## Testing

Frontend tests cover:

- Default report renders existing charts and new chart control.
- Removing a chart hides that card and persists selection.
- Re-adding a chart shows it again.
- New practical charts render from existing overview data.
- Empty stored selection renders the no-charts state.

Verification commands:

- `npm run test -- ReportsPage`
- `npm run build`
- `graphify update .`
