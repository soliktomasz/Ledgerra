using Ledgerra.Domain.Accounts;
using Ledgerra.Domain.Budgets;
using Ledgerra.Domain.Transactions;

namespace Ledgerra.Application.Dashboard;

public sealed record GetDashboardSummaryQuery(Guid UserId, int Year, int Month);

public sealed record DashboardSummaryResult(
    decimal Income,
    decimal Expenses,
    decimal Net,
    decimal BudgetRemaining,
    IReadOnlyList<DashboardCategorySpendResult> TopCategories,
    IReadOnlyList<AccountBalanceSnapshotResult> Accounts);

public sealed record DashboardCategorySpendResult(Guid CategoryId, string CategoryName, decimal Amount);

public sealed record AccountBalanceSnapshotResult(Guid AccountId, string Name, decimal Balance);

public interface IDashboardSummaryDataProvider
{
    Task<IReadOnlyList<Transaction>> GetTransactionsForMonthAsync(Guid userId, int year, int month, CancellationToken cancellationToken);

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
                AccountBalanceCalculator.Calculate(account, account.Transactions))).ToList());
    }
}