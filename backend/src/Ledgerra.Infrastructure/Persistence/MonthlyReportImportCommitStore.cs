using Ledgerra.Application.Imports;
using Ledgerra.Domain.Transactions;
using Microsoft.EntityFrameworkCore;

namespace Ledgerra.Infrastructure.Persistence;

public sealed class MonthlyReportImportCommitStore : IMonthlyReportImportCommitStore
{
    private readonly LedgerraDbContext _dbContext;

    public MonthlyReportImportCommitStore(LedgerraDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public Task<bool> AccountExistsAsync(Guid userId, Guid accountId, CancellationToken cancellationToken)
    {
        return _dbContext.Accounts.AnyAsync(item => item.UserId == userId && item.Id == accountId, cancellationToken);
    }

    public Task<bool> CategoryExistsAsync(Guid userId, Guid categoryId, CancellationToken cancellationToken)
    {
        return _dbContext.Categories.AnyAsync(item => item.UserId == userId && item.Id == categoryId, cancellationToken);
    }

    public async Task<IReadOnlyList<Transaction>> CreateTransactionsAsync(
        Guid userId,
        IReadOnlyList<MonthlyReportDraftInput> drafts,
        CancellationToken cancellationToken)
    {
        var transactions = new List<Transaction>(drafts.Count);
        foreach (var draft in drafts)
        {
            Enum.TryParse<TransactionType>(draft.Type, true, out var parsedType);
            transactions.Add(new Transaction
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                AccountId = draft.AccountId,
                CategoryId = draft.CategoryId,
                Amount = draft.Amount,
                Type = parsedType,
                Note = draft.Note,
                OccurredOnUtc = draft.OccurredOnUtc.ToUniversalTime()
            });
        }

        _dbContext.Transactions.AddRange(transactions);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return transactions;
    }
}