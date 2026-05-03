using Ledgerra.Domain.Transactions;
using Microsoft.EntityFrameworkCore;
using Ledgerra.Infrastructure.Persistence;

namespace Ledgerra.Application.Transactions;

public sealed class RecurringTransactionUseCases
{
    private readonly LedgerraDbContext _db;

    public RecurringTransactionUseCases(LedgerraDbContext db) => _db = db;

    public async Task<IReadOnlyList<RecurringTransactionTemplate>> GetAllAsync(Guid userId, CancellationToken ct)
        => await _db.RecurringTransactionTemplates.Where(x => x.UserId == userId).OrderBy(x => x.StartOnUtc).ToListAsync(ct);

    public async Task<RecurringTransactionTemplate> CreateAsync(Guid userId, Guid accountId, Guid? categoryId, decimal amount, string type, string interval, DateTime startOnUtc, string? note, CancellationToken ct)
    {
        if (startOnUtc.Kind != DateTimeKind.Utc) throw new InvalidOperationException("StartOnUtc must be UTC");
        if (!Enum.TryParse<TransactionType>(type, true, out var txType) || (txType != TransactionType.Expense && txType != TransactionType.Income)) throw new InvalidOperationException("Type must be Income or Expense");
        if (!Enum.TryParse<RecurringInterval>(interval, true, out var parsedInterval)) throw new InvalidOperationException("Interval must be Weekly or Monthly");

        var item = new RecurringTransactionTemplate
        {
            Id = Guid.NewGuid(), UserId = userId, AccountId = accountId, CategoryId = categoryId, Amount = amount, Type = txType, Interval = parsedInterval, StartOnUtc = startOnUtc, Note = note
        };
        _db.RecurringTransactionTemplates.Add(item);
        await _db.SaveChangesAsync(ct);
        return item;
    }

    public async Task<int> GenerateDueAsync(Guid userId, DateTime nowUtc, CancellationToken ct)
    {
        var templates = await _db.RecurringTransactionTemplates.Where(x => x.UserId == userId && x.IsActive).ToListAsync(ct);
        var generated = 0;
        foreach (var template in templates)
        {
            var next = template.LastGeneratedOnUtc ?? template.StartOnUtc;
            if (template.LastGeneratedOnUtc.HasValue)
            {
                next = template.Interval == RecurringInterval.Weekly ? next.AddDays(7) : next.AddMonths(1);
            }
            while (next <= nowUtc)
            {
                _db.Transactions.Add(new Transaction { Id = Guid.NewGuid(), UserId = userId, AccountId = template.AccountId, CategoryId = template.CategoryId, Amount = template.Amount, Type = template.Type, OccurredOnUtc = next, Note = template.Note });
                template.LastGeneratedOnUtc = next;
                generated++;
                next = template.Interval == RecurringInterval.Weekly ? next.AddDays(7) : next.AddMonths(1);
            }
        }
        await _db.SaveChangesAsync(ct);
        return generated;
    }
}
