using Ledgerra.Domain.Accounts;
using Ledgerra.Domain.Reporting;
using Ledgerra.Domain.Transactions;

namespace Ledgerra.Application.Reporting;

public sealed record GetReportingOverviewQuery(Guid UserId, string? RangePreset, Guid? AccountId, DateOnly? EndMonth);

public sealed record ReportingOverviewResult(
    string RangePreset,
    string StartMonth,
    string EndMonth,
    string CurrencyCode,
    ReportingSummaryResult Summary,
    IReadOnlyList<MonthlySpendingPoint> MonthlySpendingTrend,
    IReadOnlyList<MonthlyCashFlowPoint> IncomeVsExpense,
    IReadOnlyList<CategoryBreakdownPoint> CategoryBreakdown,
    IReadOnlyList<NetWorthPoint> NetWorthHistory,
    IReadOnlyList<ReportingWarningResult> Warnings);

public sealed record ReportingSummaryResult(
    decimal IncomeTotal,
    decimal ExpenseTotal,
    decimal NetCashFlow,
    decimal SpendingDeltaAmount,
    decimal? SpendingDeltaPercent,
    decimal NetWorthDelta);

public sealed record ReportingWarningResult(string Code, string Message);

public interface IReportingDataProvider
{
    Task<IReadOnlyList<Account>> GetAccountsAsync(Guid userId, Guid? accountId, CancellationToken cancellationToken);

    Task<IReadOnlyList<Transaction>> GetTransactionsAsync(
        Guid userId,
        DateTime startUtc,
        DateTime endExclusiveUtc,
        Guid? accountId,
        CancellationToken cancellationToken);

    Task<IReadOnlyDictionary<Guid, string>> GetCategoryNamesAsync(
        Guid userId,
        IReadOnlyCollection<Guid> categoryIds,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<MonthlyAccountBalanceSnapshot>> GetSnapshotsAsync(
        Guid userId,
        DateOnly startMonthEnd,
        DateOnly endMonthEnd,
        Guid? accountId,
        CancellationToken cancellationToken);
}

public interface IMonthlyAccountBalanceSnapshotService
{
    Task EnsureSnapshotsAsync(
        Guid userId,
        DateOnly startMonth,
        DateOnly endMonth,
        Guid? accountId,
        CancellationToken cancellationToken);

    Task RefreshFromAsync(Guid userId, DateOnly fromMonth, Guid? accountId, CancellationToken cancellationToken);
}

public sealed class GetReportingOverviewQueryHandler
{
    private static readonly HashSet<string> SupportedRangePresets = new(StringComparer.OrdinalIgnoreCase)
    {
        "3M",
        "6M",
        "12M",
        "YTD"
    };

    private readonly IReportingDataProvider _dataProvider;
    private readonly IMonthlyAccountBalanceSnapshotService _snapshotService;

    public GetReportingOverviewQueryHandler(
        IReportingDataProvider dataProvider,
        IMonthlyAccountBalanceSnapshotService snapshotService)
    {
        _dataProvider = dataProvider;
        _snapshotService = snapshotService;
    }

    public async Task<ReportingOverviewResult> HandleAsync(GetReportingOverviewQuery query, CancellationToken cancellationToken)
    {
        var rangePreset = NormalizeRangePreset(query.RangePreset);
        var endMonth = query.EndMonth ?? new DateOnly(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1);
        var startMonth = CalculateStartMonth(rangePreset, endMonth);
        var buckets = ReportingCalendar.BuildMonthBuckets(startMonth, endMonth);
        var startUtc = new DateTime(startMonth.Year, startMonth.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var endExclusiveUtc = new DateTime(endMonth.Year, endMonth.Month, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(1);

        var transactions = await _dataProvider.GetTransactionsAsync(
            query.UserId,
            startUtc,
            endExclusiveUtc,
            query.AccountId,
            cancellationToken);

        var categoryIds = transactions
            .Where(item => item.Type == TransactionType.Expense && item.CategoryId.HasValue)
            .Select(item => item.CategoryId!.Value)
            .Distinct()
            .ToArray();

        var categoryNames = await _dataProvider.GetCategoryNamesAsync(query.UserId, categoryIds, cancellationToken);
        var monthlySpending = TransactionAggregationCalculator.BuildMonthlySpending(buckets, transactions);
        var cashFlow = TransactionAggregationCalculator.BuildMonthlyCashFlow(buckets, transactions);
        var categoryBreakdown = CategoryBreakdownCalculator.BuildRankedBreakdown(transactions, categoryNames);
        var warnings = new List<ReportingWarningResult>();
        var accounts = await _dataProvider.GetAccountsAsync(query.UserId, query.AccountId, cancellationToken);
        IReadOnlyList<NetWorthPoint> netWorthHistory = [];
        var currencyCode = accounts.FirstOrDefault()?.CurrencyCode ?? "USD";

        if (accounts.Select(item => item.CurrencyCode).Distinct(StringComparer.OrdinalIgnoreCase).Count() > 1)
        {
            warnings.Add(new ReportingWarningResult(
                "MixedCurrencyNetWorthExcluded",
                "Net worth history is hidden because the selected accounts use multiple currencies and Ledgerra does not apply FX conversion yet."));
        }
        else if (accounts.Count > 0)
        {
            await _snapshotService.EnsureSnapshotsAsync(query.UserId, startMonth, endMonth, query.AccountId, cancellationToken);
            var snapshots = await _dataProvider.GetSnapshotsAsync(
                query.UserId,
                ReportingCalendar.MonthEnd(startMonth),
                ReportingCalendar.MonthEnd(endMonth),
                query.AccountId,
                cancellationToken);
            netWorthHistory = NetWorthRollupCalculator.BuildNetWorthHistory(buckets, snapshots, currencyCode);
        }

        return new ReportingOverviewResult(
            rangePreset,
            ReportingCalendar.FormatMonth(startMonth),
            ReportingCalendar.FormatMonth(endMonth),
            currencyCode,
            BuildSummary(cashFlow, monthlySpending, netWorthHistory),
            monthlySpending,
            cashFlow,
            categoryBreakdown,
            netWorthHistory,
            warnings);
    }

    private static ReportingSummaryResult BuildSummary(
        IReadOnlyList<MonthlyCashFlowPoint> cashFlow,
        IReadOnlyList<MonthlySpendingPoint> spending,
        IReadOnlyList<NetWorthPoint> netWorthHistory)
    {
        var incomeTotal = cashFlow.Sum(item => item.Income);
        var expenseTotal = cashFlow.Sum(item => item.Expenses);
        var currentSpending = spending.Count > 0 ? spending[^1].Amount : 0m;
        var previousSpending = spending.Count > 1 ? spending[^2].Amount : 0m;
        var spendingDeltaAmount = currentSpending - previousSpending;
        decimal? spendingDeltaPercent = previousSpending == 0m
            ? null
            : Math.Round(spendingDeltaAmount / previousSpending * 100m, 2);
        var netWorthDelta = netWorthHistory.Count > 1
            ? netWorthHistory[^1].NetWorth - netWorthHistory[0].NetWorth
            : 0m;

        return new ReportingSummaryResult(
            incomeTotal,
            expenseTotal,
            incomeTotal - expenseTotal,
            spendingDeltaAmount,
            spendingDeltaPercent,
            netWorthDelta);
    }

    private static string NormalizeRangePreset(string? rangePreset)
    {
        if (string.IsNullOrWhiteSpace(rangePreset))
        {
            return "12M";
        }

        return SupportedRangePresets.Contains(rangePreset) ? rangePreset.ToUpperInvariant() : "12M";
    }

    private static DateOnly CalculateStartMonth(string rangePreset, DateOnly endMonth)
    {
        var normalizedEnd = new DateOnly(endMonth.Year, endMonth.Month, 1);

        return rangePreset switch
        {
            "3M" => normalizedEnd.AddMonths(-2),
            "6M" => normalizedEnd.AddMonths(-5),
            "YTD" => new DateOnly(normalizedEnd.Year, 1, 1),
            _ => normalizedEnd.AddMonths(-11)
        };
    }
}
