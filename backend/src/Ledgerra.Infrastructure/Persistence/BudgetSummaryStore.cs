using Ledgerra.Application.Budgets;
using Ledgerra.Domain.Budgets;
using Ledgerra.Domain.Transactions;
using Microsoft.EntityFrameworkCore;

namespace Ledgerra.Infrastructure.Persistence;

public sealed class BudgetSummaryStore : IBudgetSummaryStore
{
    private readonly LedgerraDbContext _dbContext;

    public BudgetSummaryStore(LedgerraDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<BudgetSummary> GetSummaryAsync(Guid userId, int year, int month, CancellationToken cancellationToken)
    {
        var period = await GetOrCreateBudgetPeriodAsync(userId, year, month, cancellationToken);
        var transactions = await GetTransactionsForMonthAsync(userId, year, month, cancellationToken);
        var carryForwardByCategory = await BuildCarryForwardMapAsync(userId, year, month, cancellationToken);
        return BudgetSummaryCalculator.BuildMonthlySummary(period, transactions, carryForwardByCategory);
    }

    public async Task<bool> CategoriesExistAsync(Guid userId, IReadOnlyCollection<Guid> categoryIds, CancellationToken cancellationToken)
    {
        var distinctIds = categoryIds.Distinct().ToArray();
        if (distinctIds.Length == 0)
        {
            return true;
        }

        var count = await _dbContext.Categories
            .Where(category => category.UserId == userId && distinctIds.Contains(category.Id))
            .CountAsync(cancellationToken);

        return count == distinctIds.Length;
    }

    public async Task<BudgetSummary> UpdateAsync(
        Guid userId,
        int year,
        int month,
        IReadOnlyList<BudgetCategoryLimitInput> categoryLimits,
        CancellationToken cancellationToken)
    {
        var period = await GetOrCreateBudgetPeriodAsync(userId, year, month, cancellationToken);
        var existingLimits = await _dbContext.BudgetCategoryLimits
            .Where(item => item.BudgetPeriodId == period.Id)
            .ToListAsync(cancellationToken);

        if (existingLimits.Count > 0)
        {
            _dbContext.BudgetCategoryLimits.RemoveRange(existingLimits);
        }

        var newLimits = categoryLimits.Select(item => new BudgetCategoryLimit
        {
            Id = Guid.NewGuid(),
            BudgetPeriodId = period.Id,
            CategoryId = item.CategoryId,
            PlannedAmount = item.PlannedAmount,
            CarryOverUnspent = item.CarryOverUnspent
        }).ToList();

        _dbContext.BudgetCategoryLimits.AddRange(newLimits);
        await _dbContext.SaveChangesAsync(cancellationToken);

        var refreshedPeriod = await _dbContext.BudgetPeriods
            .Include(item => item.CategoryLimits)
            .ThenInclude(item => item.Category)
            .SingleAsync(item => item.Id == period.Id, cancellationToken);

        var transactions = await GetTransactionsForMonthAsync(userId, year, month, cancellationToken);
        var carryForwardByCategory = await BuildCarryForwardMapAsync(userId, year, month, cancellationToken);
        return BudgetSummaryCalculator.BuildMonthlySummary(refreshedPeriod, transactions, carryForwardByCategory);
    }

    private async Task<BudgetPeriod> GetOrCreateBudgetPeriodAsync(Guid userId, int year, int month, CancellationToken cancellationToken)
    {
        var period = await _dbContext.BudgetPeriods
            .Include(item => item.CategoryLimits)
            .ThenInclude(item => item.Category)
            .SingleOrDefaultAsync(item => item.UserId == userId && item.Year == year && item.Month == month, cancellationToken);

        if (period is not null)
        {
            return period;
        }

        period = new BudgetPeriod
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Year = year,
            Month = month
        };

        _dbContext.BudgetPeriods.Add(period);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return period;
    }


    private async Task<Dictionary<Guid, decimal>> BuildCarryForwardMapAsync(Guid userId, int year, int month, CancellationToken cancellationToken)
    {
        var previousMonth = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(-1);
        var previousPeriod = await _dbContext.BudgetPeriods
            .Include(item => item.CategoryLimits)
            .ThenInclude(item => item.Category)
            .SingleOrDefaultAsync(item => item.UserId == userId && item.Year == previousMonth.Year && item.Month == previousMonth.Month, cancellationToken);

        if (previousPeriod is null || previousPeriod.CategoryLimits.Count == 0)
        {
            return [];
        }

        var previousTransactions = await GetTransactionsForMonthAsync(userId, previousMonth.Year, previousMonth.Month, cancellationToken);
        var previousCarryForwards = await BuildCarryForwardMapAsync(userId, previousMonth.Year, previousMonth.Month, cancellationToken);
        var previousSummary = BudgetSummaryCalculator.BuildMonthlySummary(previousPeriod, previousTransactions, previousCarryForwards);

        return previousSummary.Categories
            .Where(item => item.CarryOverUnspent && item.Remaining > 0)
            .ToDictionary(item => item.CategoryId, item => item.Remaining);
    }
    private async Task<List<Transaction>> GetTransactionsForMonthAsync(Guid userId, int year, int month, CancellationToken cancellationToken)
    {
        var monthStart = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc);
        var monthEnd = monthStart.AddMonths(1);

        return await _dbContext.Transactions
            .Where(item => item.UserId == userId && item.OccurredOnUtc >= monthStart && item.OccurredOnUtc < monthEnd)
            .ToListAsync(cancellationToken);
    }
}
