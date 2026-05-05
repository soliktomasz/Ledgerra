using Ledgerra.Domain.Transactions;

namespace Ledgerra.Application.Transactions;

public sealed class RecurringTransactionUseCases
{
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
                var next = template.LastGeneratedOnUtc ?? template.StartOnUtc;
                if (template.LastGeneratedOnUtc.HasValue)
                {
                    next = template.Interval == RecurringInterval.Weekly ? next.AddDays(7) : next.AddMonths(1);
                }
                while (next <= nowUtc)
                {
                    await _repository.AddTransactionAsync(new Transaction { Id = Guid.NewGuid(), UserId = userId, AccountId = template.AccountId, CategoryId = template.CategoryId, Amount = template.Amount, Type = template.Type, OccurredOnUtc = next, Note = template.Note }, ct);
                    template.LastGeneratedOnUtc = next;
                    generated++;
                    next = template.Interval == RecurringInterval.Weekly ? next.AddDays(7) : next.AddMonths(1);
                }
            }
            await _repository.SaveChangesAsync(ct);
            return generated;
        }, ct);
    }
}
