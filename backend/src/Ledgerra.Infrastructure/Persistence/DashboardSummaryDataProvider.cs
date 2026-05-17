using Ledgerra.Application.Dashboard;
using Ledgerra.Domain.Accounts;
using Ledgerra.Domain.Budgets;
using Ledgerra.Domain.Transactions;
using Microsoft.EntityFrameworkCore;

namespace Ledgerra.Infrastructure.Persistence;

public sealed class DashboardSummaryDataProvider : IDashboardSummaryDataProvider
{
    private readonly LedgerraDbContext _dbContext;

    public DashboardSummaryDataProvider(LedgerraDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<Transaction>> GetTransactionsForMonthAsync(Guid userId, int year, int month, CancellationToken cancellationToken)
    {
        var monthStart = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc);
        var monthEnd = monthStart.AddMonths(1);

        return await GetTransactionsForRangeAsync(userId, monthStart, monthEnd, cancellationToken);
    }

    public async Task<IReadOnlyList<Transaction>> GetTransactionsForRangeAsync(
        Guid userId,
        DateTime startUtc,
        DateTime endExclusiveUtc,
        CancellationToken cancellationToken)
    {
        return await _dbContext.Transactions
            .Where(item => item.UserId == userId && item.OccurredOnUtc >= startUtc && item.OccurredOnUtc < endExclusiveUtc)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<Account>> GetAccountsAsync(Guid userId, CancellationToken cancellationToken)
    {
        return await _dbContext.Accounts
            .Where(item => item.UserId == userId)
            .Include(item => item.Transactions)
            .OrderBy(item => item.Name)
            .ToListAsync(cancellationToken);
    }

    public async Task<BudgetPeriod?> GetBudgetPeriodAsync(Guid userId, int year, int month, CancellationToken cancellationToken)
    {
        return await _dbContext.BudgetPeriods
            .Include(item => item.CategoryLimits)
            .ThenInclude(item => item.Category)
            .SingleOrDefaultAsync(item => item.UserId == userId && item.Year == year && item.Month == month, cancellationToken);
    }

    public async Task<IReadOnlyDictionary<Guid, decimal>> GetBudgetCarryForwardAsync(Guid userId, int year, int month, CancellationToken cancellationToken)
    {
        return await BuildCarryForwardMapAsync(userId, year, month, cancellationToken);
    }

    public async Task<IReadOnlyDictionary<Guid, string>> GetCategoryNamesAsync(
        Guid userId,
        IReadOnlyCollection<Guid> categoryIds,
        CancellationToken cancellationToken)
    {
        if (categoryIds.Count == 0)
        {
            return new Dictionary<Guid, string>();
        }

        return await _dbContext.Categories
            .Where(item => item.UserId == userId && categoryIds.Contains(item.Id))
            .ToDictionaryAsync(item => item.Id, item => item.Name, cancellationToken);
    }

    private async Task<Dictionary<Guid, decimal>> BuildCarryForwardMapAsync(Guid userId, int year, int month, CancellationToken cancellationToken)
    {
        var previousMonth = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(-1);
        var previousPeriod = await GetBudgetPeriodAsync(userId, previousMonth.Year, previousMonth.Month, cancellationToken);

        if (previousPeriod is null || previousPeriod.CategoryLimits.Count == 0)
        {
            return [];
        }

        var previousTransactions = await GetTransactionsForMonthAsync(userId, previousMonth.Year, previousMonth.Month, cancellationToken);
        var previousCarryForward = await BuildCarryForwardMapAsync(userId, previousMonth.Year, previousMonth.Month, cancellationToken);
        var previousSummary = BudgetSummaryCalculator.BuildMonthlySummary(previousPeriod, previousTransactions, previousCarryForward);

        return previousSummary.Categories
            .Where(item => item.CarryOverUnspent && item.Remaining > 0)
            .ToDictionary(item => item.CategoryId, item => item.Remaining);
    }
}
