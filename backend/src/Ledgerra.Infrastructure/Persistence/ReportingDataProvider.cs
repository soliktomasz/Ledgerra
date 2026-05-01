using Ledgerra.Application.Reporting;
using Ledgerra.Domain.Accounts;
using Ledgerra.Domain.Transactions;
using Microsoft.EntityFrameworkCore;

namespace Ledgerra.Infrastructure.Persistence;

public sealed class ReportingDataProvider : IReportingDataProvider
{
    private readonly LedgerraDbContext _dbContext;

    public ReportingDataProvider(LedgerraDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<Account>> GetAccountsAsync(Guid userId, Guid? accountId, CancellationToken cancellationToken)
    {
        var query = _dbContext.Accounts.Where(item => item.UserId == userId);

        if (accountId.HasValue)
        {
            query = query.Where(item => item.Id == accountId.Value);
        }

        return await query.OrderBy(item => item.Name).ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<Transaction>> GetTransactionsAsync(
        Guid userId,
        DateTime startUtc,
        DateTime endExclusiveUtc,
        Guid? accountId,
        CancellationToken cancellationToken)
    {
        var query = _dbContext.Transactions
            .Where(item => item.UserId == userId && item.OccurredOnUtc >= startUtc && item.OccurredOnUtc < endExclusiveUtc);

        if (accountId.HasValue)
        {
            query = query.Where(item => item.AccountId == accountId.Value);
        }

        return await query.ToListAsync(cancellationToken);
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

    public async Task<IReadOnlyList<MonthlyAccountBalanceSnapshot>> GetSnapshotsAsync(
        Guid userId,
        DateOnly startMonthEnd,
        DateOnly endMonthEnd,
        Guid? accountId,
        CancellationToken cancellationToken)
    {
        var query = _dbContext.MonthlyAccountBalanceSnapshots
            .Where(item => item.UserId == userId && item.MonthEndDate >= startMonthEnd && item.MonthEndDate <= endMonthEnd);

        if (accountId.HasValue)
        {
            query = query.Where(item => item.AccountId == accountId.Value);
        }

        return await query.ToListAsync(cancellationToken);
    }
}
