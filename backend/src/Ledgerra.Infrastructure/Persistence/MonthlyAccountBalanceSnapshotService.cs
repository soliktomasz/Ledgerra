using Ledgerra.Application.Reporting;
using Ledgerra.Domain.Accounts;
using Ledgerra.Domain.Reporting;
using Microsoft.EntityFrameworkCore;

namespace Ledgerra.Infrastructure.Persistence;

public sealed class MonthlyAccountBalanceSnapshotService : IMonthlyAccountBalanceSnapshotService
{
    private readonly LedgerraDbContext _dbContext;

    public MonthlyAccountBalanceSnapshotService(LedgerraDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task EnsureSnapshotsAsync(
        Guid userId,
        DateOnly startMonth,
        DateOnly endMonth,
        Guid? accountId,
        CancellationToken cancellationToken)
    {
        var buckets = ReportingCalendar.BuildMonthBuckets(startMonth, endMonth);
        if (buckets.Count == 0)
        {
            return;
        }

        var startMonthEnd = ReportingCalendar.MonthEnd(startMonth);
        var endMonthEnd = ReportingCalendar.MonthEnd(endMonth);
        var snapshotsQuery = _dbContext.MonthlyAccountBalanceSnapshots
            .Where(item => item.UserId == userId && item.MonthEndDate >= startMonthEnd && item.MonthEndDate <= endMonthEnd);

        if (accountId.HasValue)
        {
            snapshotsQuery = snapshotsQuery.Where(item => item.AccountId == accountId.Value);
        }

        var existingMonthEnds = await snapshotsQuery
            .Select(item => item.MonthEndDate)
            .Distinct()
            .ToListAsync(cancellationToken);

        var missingBuckets = buckets
            .Where(bucket => !existingMonthEnds.Contains(ReportingCalendar.MonthEnd(bucket.MonthStart)))
            .ToList();

        if (missingBuckets.Count == 0)
        {
            return;
        }

        var missingStart = missingBuckets.Min(bucket => bucket.MonthStart);
        var missingEnd = missingBuckets.Max(bucket => bucket.MonthStart);
        await RecomputeAsync(userId, missingStart, missingEnd, accountId, cancellationToken);
    }

    public async Task RefreshFromAsync(Guid userId, DateOnly fromMonth, Guid? accountId, CancellationToken cancellationToken)
    {
        var currentMonth = new DateOnly(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1);
        var latestTransactionQuery = _dbContext.Transactions
            .Where(item => item.UserId == userId);

        if (accountId.HasValue)
        {
            latestTransactionQuery = latestTransactionQuery.Where(item => item.AccountId == accountId.Value);
        }

        var latestTransactionMonth = await latestTransactionQuery
            .Select(item => (DateTime?)item.OccurredOnUtc)
            .MaxAsync(cancellationToken);

        var endMonth = latestTransactionMonth.HasValue
            ? MaxMonth(currentMonth, new DateOnly(latestTransactionMonth.Value.Year, latestTransactionMonth.Value.Month, 1))
            : currentMonth;

        await RecomputeAsync(userId, fromMonth, endMonth, accountId, cancellationToken);
    }

    private async Task RecomputeAsync(
        Guid userId,
        DateOnly startMonth,
        DateOnly endMonth,
        Guid? accountId,
        CancellationToken cancellationToken)
    {
        var buckets = ReportingCalendar.BuildMonthBuckets(startMonth, endMonth);
        if (buckets.Count == 0)
        {
            return;
        }

        var accountsQuery = _dbContext.Accounts
            .Include(item => item.Transactions)
            .Where(item => item.UserId == userId);

        if (accountId.HasValue)
        {
            accountsQuery = accountsQuery.Where(item => item.Id == accountId.Value);
        }

        var accounts = await accountsQuery.ToListAsync(cancellationToken);
        var startMonthEnd = ReportingCalendar.MonthEnd(startMonth);
        var endMonthEnd = ReportingCalendar.MonthEnd(endMonth);
        var snapshotsQuery = _dbContext.MonthlyAccountBalanceSnapshots
            .Where(item => item.UserId == userId && item.MonthEndDate >= startMonthEnd && item.MonthEndDate <= endMonthEnd);

        if (accountId.HasValue)
        {
            snapshotsQuery = snapshotsQuery.Where(item => item.AccountId == accountId.Value);
        }

        var existingSnapshots = await snapshotsQuery.ToListAsync(cancellationToken);
        var existingByKey = existingSnapshots.ToDictionary(item => (item.AccountId, item.MonthEndDate));

        foreach (var account in accounts)
        {
            foreach (var bucket in buckets)
            {
                var monthEnd = ReportingCalendar.MonthEnd(bucket.MonthStart);
                var monthEndExclusive = new DateTime(bucket.MonthStart.Year, bucket.MonthStart.Month, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(1);
                var balance = AccountBalanceCalculator.Calculate(
                    account,
                    account.Transactions.Where(item => item.OccurredOnUtc < monthEndExclusive));

                if (existingByKey.TryGetValue((account.Id, monthEnd), out var snapshot))
                {
                    snapshot.Balance = balance;
                    snapshot.CurrencyCode = account.CurrencyCode;
                    continue;
                }

                _dbContext.MonthlyAccountBalanceSnapshots.Add(new MonthlyAccountBalanceSnapshot
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    AccountId = account.Id,
                    MonthEndDate = monthEnd,
                    Balance = balance,
                    CurrencyCode = account.CurrencyCode
                });
            }
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private static DateOnly MaxMonth(DateOnly left, DateOnly right) => left >= right ? left : right;
}
