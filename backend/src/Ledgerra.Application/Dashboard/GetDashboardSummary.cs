using Ledgerra.Domain.Accounts;
using Ledgerra.Domain.Budgets;
using Ledgerra.Domain.Reporting;
using Ledgerra.Domain.Transactions;

namespace Ledgerra.Application.Dashboard;

public sealed record GetDashboardSummaryQuery(Guid UserId, int Year, int Month);

public sealed record DashboardSummaryResult(
    decimal Income,
    decimal Expenses,
    decimal Net,
    decimal BudgetRemaining,
    IReadOnlyList<DashboardCategorySpendResult> TopCategories,
    IReadOnlyList<AccountBalanceSnapshotResult> Accounts,
    DashboardTrendsResult Trends);

public sealed record DashboardCategorySpendResult(Guid CategoryId, string CategoryName, decimal Amount);

public sealed record AccountBalanceSnapshotResult(Guid AccountId, string Name, decimal Balance);

public sealed record DashboardTrendsResult(
    decimal SpendingDeltaAmount,
    decimal? SpendingDeltaPercent,
    IReadOnlyList<DashboardSpendingSparklinePointResult> SpendingSparkline);

public sealed record DashboardSpendingSparklinePointResult(string Month, decimal Amount);

public interface IDashboardSummaryDataProvider
{
    Task<IReadOnlyList<Transaction>> GetTransactionsForMonthAsync(Guid userId, int year, int month, CancellationToken cancellationToken);

    Task<IReadOnlyList<Transaction>> GetTransactionsForRangeAsync(
        Guid userId,
        DateTime startUtc,
        DateTime endExclusiveUtc,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<Account>> GetAccountsAsync(Guid userId, CancellationToken cancellationToken);

    Task<BudgetPeriod?> GetBudgetPeriodAsync(Guid userId, int year, int month, CancellationToken cancellationToken);

    Task<IReadOnlyDictionary<Guid, string>> GetCategoryNamesAsync(
        Guid userId,
        IReadOnlyCollection<Guid> categoryIds,
        CancellationToken cancellationToken);
}

public sealed class GetDashboardSummaryQueryHandler
{
    private readonly IDashboardSummaryDataProvider _dataProvider;

    public GetDashboardSummaryQueryHandler(IDashboardSummaryDataProvider dataProvider)
    {
        _dataProvider = dataProvider;
    }

    public async Task<DashboardSummaryResult> HandleAsync(GetDashboardSummaryQuery query, CancellationToken cancellationToken)
    {
        var transactions = await _dataProvider.GetTransactionsForMonthAsync(query.UserId, query.Year, query.Month, cancellationToken);
        var trendStartMonth = new DateOnly(query.Year, query.Month, 1).AddMonths(-5);
        var trendStartUtc = new DateTime(trendStartMonth.Year, trendStartMonth.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var trendEndUtc = new DateTime(query.Year, query.Month, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(1);
        var trendTransactions = await _dataProvider.GetTransactionsForRangeAsync(query.UserId, trendStartUtc, trendEndUtc, cancellationToken);
        var accounts = await _dataProvider.GetAccountsAsync(query.UserId, cancellationToken);
        var period = await _dataProvider.GetBudgetPeriodAsync(query.UserId, query.Year, query.Month, cancellationToken);

        var budgetRemaining = period is null
            ? 0m
            : BudgetSummaryCalculator.BuildMonthlySummary(period, transactions).TotalRemaining;

        var topCategoryIds = transactions
            .Where(item => item.Type == TransactionType.Expense && item.CategoryId.HasValue)
            .Select(item => item.CategoryId!.Value)
            .Distinct()
            .ToArray();

        var categoryNames = await _dataProvider.GetCategoryNamesAsync(query.UserId, topCategoryIds, cancellationToken);

        var topCategories = transactions
            .Where(item => item.Type == TransactionType.Expense && item.CategoryId.HasValue)
            .GroupBy(item => item.CategoryId!.Value)
            .Select(group => new DashboardCategorySpendResult(
                group.Key,
                categoryNames.GetValueOrDefault(group.Key, "Uncategorized"),
                group.Sum(item => item.Amount)))
            .OrderByDescending(item => item.Amount)
            .Take(5)
            .ToList();

        var income = transactions.Where(item => item.Type == TransactionType.Income).Sum(item => item.Amount);
        var expenses = transactions.Where(item => item.Type == TransactionType.Expense).Sum(item => item.Amount);

        return new DashboardSummaryResult(
            income,
            expenses,
            income - expenses,
            budgetRemaining,
            topCategories,
            accounts.Select(account => new AccountBalanceSnapshotResult(
                account.Id,
                account.Name,
                AccountBalanceCalculator.Calculate(account, account.Transactions))).ToList(),
            BuildTrends(query.Year, query.Month, trendTransactions));
    }

    private static DashboardTrendsResult BuildTrends(int year, int month, IReadOnlyList<Transaction> transactions)
    {
        var endMonth = new DateOnly(year, month, 1);
        var buckets = ReportingCalendar.BuildMonthBuckets(endMonth.AddMonths(-5), endMonth);
        var spending = TransactionAggregationCalculator.BuildMonthlySpending(buckets, transactions)
            .Select(item => new DashboardSpendingSparklinePointResult(item.Month, item.Amount))
            .ToList();
        var currentSpending = spending.Count > 0 ? spending[^1].Amount : 0m;
        var previousSpending = spending.Count > 1 ? spending[^2].Amount : 0m;
        var delta = currentSpending - previousSpending;
        decimal? percent = previousSpending == 0m ? null : Math.Round(delta / previousSpending * 100m, 2);

        return new DashboardTrendsResult(delta, percent, spending);
    }
}
