using Ledgerra.Application.Transactions;
using Ledgerra.Domain.Transactions;
using Microsoft.EntityFrameworkCore;

namespace Ledgerra.Infrastructure.Persistence;

public sealed class TransactionQueryStore : ITransactionQueryStore
{
    private readonly LedgerraDbContext _dbContext;

    public TransactionQueryStore(LedgerraDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<Transaction>> GetAllAsync(
        Guid userId,
        Guid? accountId,
        Guid? categoryId,
        TransactionType? type,
        DateTime? fromUtc,
        DateTime? toUtc,
        CancellationToken cancellationToken)
    {
        var query = _dbContext.Transactions.Where(item => item.UserId == userId);

        if (accountId.HasValue)
        {
            query = query.Where(item => item.AccountId == accountId.Value);
        }

        if (categoryId.HasValue)
        {
            query = query.Where(item => item.CategoryId == categoryId.Value);
        }

        if (type.HasValue)
        {
            query = query.Where(item => item.Type == type.Value);
        }

        if (fromUtc.HasValue)
        {
            query = query.Where(item => item.OccurredOnUtc >= fromUtc.Value);
        }

        if (toUtc.HasValue)
        {
            query = query.Where(item => item.OccurredOnUtc <= toUtc.Value);
        }

        return await query
            .OrderByDescending(item => item.OccurredOnUtc)
            .ToListAsync(cancellationToken);
    }

    public Task<Transaction?> GetByIdAsync(Guid userId, Guid transactionId, CancellationToken cancellationToken)
    {
        return _dbContext.Transactions.SingleOrDefaultAsync(
            item => item.UserId == userId && item.Id == transactionId,
            cancellationToken);
    }
}