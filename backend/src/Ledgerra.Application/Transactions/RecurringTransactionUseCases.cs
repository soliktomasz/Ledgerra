using Ledgerra.Domain.Transactions;

namespace Ledgerra.Application.Transactions;

public interface IRecurringTransactionRepository
{
    Task<IReadOnlyList<RecurringTransactionTemplate>> GetAllAsync(Guid userId, CancellationToken ct);
    Task<RecurringTransactionTemplate> CreateAsync(RecurringTransactionTemplate template, CancellationToken ct);
    Task<bool> AccountExistsAsync(Guid userId, Guid accountId, CancellationToken ct);
    Task<bool> CategoryExistsAsync(Guid userId, Guid categoryId, CancellationToken ct);
    Task<IReadOnlyList<RecurringTransactionTemplate>> GetActiveTemplatesAsync(Guid userId, CancellationToken ct);
    Task AddTransactionAsync(Transaction transaction, CancellationToken ct);
    Task SaveChangesAsync(CancellationToken ct);
    Task<T> ExecuteInSerializableTransactionAsync<T>(Func<Task<T>> action, CancellationToken ct);
}

public sealed class RecurringTransactionUseCases
{
    private const int MaxCatchUpPerTemplate = 100;
    private readonly IRecurringTransactionRepository _repository;

    public RecurringTransactionUseCases(IRecurringTransactionRepository repository) => _repository = repository;

    public async Task<IReadOnlyList<RecurringTransactionTemplate>> GetAllAsync(Guid userId, CancellationToken ct)
        => await _repository.GetAllAsync(userId, ct);

    public async Task<RecurringTransactionTemplate> CreateAsync(Guid userId, Guid accountId, Guid? categoryId, decimal amount, string type, string interval, DateTime startOnUtc, string? note, CancellationToken ct)
    {
        if (startOnUtc.Kind != DateTimeKind.Utc) throw new InvalidOperationException("StartOnUtc must be UTC");
        if (!Enum.TryParse<TransactionType>(type, true, out var txType) || (txType != TransactionType.Expense && txType != TransactionType.Income)) throw new InvalidOperationException("Type must be Income or Expense");
        if (!Enum.TryParse<RecurringInterval>(interval, true, out var parsedInterval)) throw new InvalidOperationException("Interval must be Weekly or Monthly");

        // Verify account ownership
        if (!await _repository.AccountExistsAsync(userId, accountId, ct))
            throw new InvalidOperationException("Account not found or does not belong to user");

        // Verify category ownership if provided
        if (categoryId.HasValue && !await _repository.CategoryExistsAsync(userId, categoryId.Value, ct))
            throw new InvalidOperationException("Category not found or does not belong to user");

        var item = new RecurringTransactionTemplate
        {
            Id = Guid.NewGuid(), UserId = userId, AccountId = accountId, CategoryId = categoryId, Amount = amount, Type = txType, Interval = parsedInterval, StartOnUtc = startOnUtc, Note = note
        };
        return await _repository.CreateAsync(item, ct);
    }

    public async Task<int> GenerateDueAsync(Guid userId, DateTime nowUtc, CancellationToken ct)
    {
        return await _repository.ExecuteInSerializableTransactionAsync(async () =>
        {
            var templates = await _repository.GetActiveTemplatesAsync(userId, ct);
            var generated = 0;
            foreach (var template in templates)
            {
                var catchUpCount = 0;
                var next = template.LastGeneratedOnUtc ?? template.StartOnUtc;
                if (template.LastGeneratedOnUtc.HasValue)
                {
                    next = template.Interval == RecurringInterval.Weekly
                        ? next.AddDays(7)
                        : GetNextAnchoredMonthlyOccurrence(template.StartOnUtc, next);
                }
                while (next <= nowUtc && catchUpCount < MaxCatchUpPerTemplate)
                {
                    await _repository.AddTransactionAsync(new Transaction { Id = Guid.NewGuid(), UserId = userId, AccountId = template.AccountId, CategoryId = template.CategoryId, Amount = template.Amount, Type = template.Type, OccurredOnUtc = next, Note = template.Note }, ct);
                    template.LastGeneratedOnUtc = next;
                    generated++;
                    catchUpCount++;
                    next = template.Interval == RecurringInterval.Weekly
                        ? next.AddDays(7)
                        : GetNextAnchoredMonthlyOccurrence(template.StartOnUtc, next);
                }
            }
            await _repository.SaveChangesAsync(ct);
            return generated;
        }, ct);
    }

    private static DateTime GetNextAnchoredMonthlyOccurrence(DateTime startOnUtc, DateTime previousOccurrenceUtc)
    {
        // Compute next month/year from previous occurrence
        var year = previousOccurrenceUtc.Year;
        var month = previousOccurrenceUtc.Month + 1;
        if (month > 12)
        {
            month = 1;
            year++;
        }

        // Anchor to the original day from startOnUtc, clamped to valid days in target month
        var day = Math.Min(startOnUtc.Day, DateTime.DaysInMonth(year, month));

        // Preserve the time components from startOnUtc
        return new DateTime(year, month, day, startOnUtc.Hour, startOnUtc.Minute, startOnUtc.Second, DateTimeKind.Utc);
    }
}
