namespace Ledgerra.Api.Contracts;

public sealed record DashboardSummaryResponse(
    decimal Income,
    decimal Expenses,
    decimal Net,
    decimal BudgetRemaining,
    IReadOnlyList<DashboardCategorySpendResponse> TopCategories,
    IReadOnlyList<AccountBalanceSnapshot> Accounts);

public sealed record DashboardCategorySpendResponse(Guid CategoryId, string CategoryName, decimal Amount);

public sealed record AccountBalanceSnapshot(Guid AccountId, string Name, decimal Balance);
