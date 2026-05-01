namespace Ledgerra.Api.Contracts;

public sealed record DashboardSummaryResponse(
    decimal Income,
    decimal Expenses,
    decimal Net,
    decimal BudgetRemaining,
    IReadOnlyList<DashboardCategorySpendResponse> TopCategories,
    IReadOnlyList<AccountBalanceSnapshot> Accounts,
    DashboardTrendsResponse Trends);

public sealed record DashboardCategorySpendResponse(Guid CategoryId, string CategoryName, decimal Amount);

public sealed record AccountBalanceSnapshot(Guid AccountId, string Name, decimal Balance);

public sealed record DashboardTrendsResponse(
    decimal SpendingDeltaAmount,
    decimal? SpendingDeltaPercent,
    IReadOnlyList<DashboardSpendingSparklinePointResponse> SpendingSparkline);

public sealed record DashboardSpendingSparklinePointResponse(string Month, decimal Amount);
