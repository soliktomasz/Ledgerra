using Ledgerra.Application.Reporting;
using Ledgerra.Domain.Accounts;
using Ledgerra.Domain.Transactions;
using Ledgerra.Domain.ExchangeRates;
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
        var query = _dbContext.Accounts.Where(item => item.UserId == userId && !item.ExcludeFromNetWorth);

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
            .Where(item => item.UserId == userId && item.OccurredOnUtc >= startUtc && item.OccurredOnUtc < endExclusiveUtc)
            .Where(item => !item.Account!.ExcludeFromBudget);

        if (accountId.HasValue)
        {
            query = query.Where(item => item.AccountId == accountId.Value);
        }

        return await query
            .Include(item => item.Account)
            .ToListAsync(cancellationToken);
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
            .Where(item => item.UserId == userId && item.MonthEndDate >= startMonthEnd && item.MonthEndDate <= endMonthEnd)
            .Where(item => !item.Account!.ExcludeFromNetWorth);

        if (accountId.HasValue)
        {
            query = query.Where(item => item.AccountId == accountId.Value);
        }

        return await query.ToListAsync(cancellationToken);
    }

    public async Task<string> GetPreferredCurrencyCodeAsync(Guid userId, CancellationToken cancellationToken)
    {
        return await _dbContext.Users
            .Where(user => user.Id == userId)
            .Select(user => user.PreferredCurrencyCode)
            .SingleOrDefaultAsync(cancellationToken) ?? "USD";
    }

    public async Task<IReadOnlyList<FxConversionRate>> GetExchangeRatesAsync(Guid userId, CancellationToken cancellationToken)
    {
        return await _dbContext.ExchangeRates
            .Where(rate => rate.UserId == userId)
            .Select(rate => new FxConversionRate(rate.FromCurrencyCode, rate.ToCurrencyCode, rate.Month, rate.Rate))
            .ToListAsync(cancellationToken);
    }
}
