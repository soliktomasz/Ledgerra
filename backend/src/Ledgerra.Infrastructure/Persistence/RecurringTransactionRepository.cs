using Ledgerra.Application.Transactions;
using Ledgerra.Domain.Transactions;
using Microsoft.EntityFrameworkCore;

namespace Ledgerra.Infrastructure.Persistence;

public sealed class RecurringTransactionRepository : IRecurringTransactionRepository
{
    private readonly LedgerraDbContext _dbContext;

    public RecurringTransactionRepository(LedgerraDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<RecurringTransactionTemplate>> GetAllAsync(Guid userId, CancellationToken ct)
    {
        return await _dbContext.RecurringTransactionTemplates
            .Where(item => item.UserId == userId)
            .OrderBy(item => item.StartOnUtc)
            .ToListAsync(ct);
    }

    public async Task<RecurringTransactionTemplate?> GetByIdAsync(Guid userId, Guid templateId, CancellationToken ct)
    {
        return await _dbContext.RecurringTransactionTemplates
            .SingleOrDefaultAsync(item => item.UserId == userId && item.Id == templateId, ct);
    }

    public async Task<IReadOnlyList<Guid>> GetUserIdsWithActiveTemplatesAsync(CancellationToken ct)
    {
        return await _dbContext.RecurringTransactionTemplates
            .Where(item => item.IsActive)
            .Select(item => item.UserId)
            .Distinct()
            .ToListAsync(ct);
    }

    public async Task<RecurringTransactionTemplate> CreateAsync(RecurringTransactionTemplate template, CancellationToken ct)
    {
        _dbContext.RecurringTransactionTemplates.Add(template);
        await _dbContext.SaveChangesAsync(ct);
        return template;
    }

    public Task<bool> AccountExistsAsync(Guid userId, Guid accountId, CancellationToken ct)
    {
        return _dbContext.Accounts.AnyAsync(item => item.UserId == userId && item.Id == accountId, ct);
    }

    public Task<bool> CategoryExistsAsync(Guid userId, Guid categoryId, CancellationToken ct)
    {
        return _dbContext.Categories.AnyAsync(item => item.UserId == userId && item.Id == categoryId, ct);
    }

    public async Task<IReadOnlyList<RecurringTransactionTemplate>> GetActiveTemplatesAsync(Guid userId, CancellationToken ct)
    {
        return await _dbContext.RecurringTransactionTemplates
            .Where(item => item.UserId == userId && item.IsActive)
            .OrderBy(item => item.StartOnUtc)
            .ToListAsync(ct);
    }

    public Task AddTransactionAsync(Transaction transaction, CancellationToken ct)
    {
        _dbContext.Transactions.Add(transaction);
        return Task.CompletedTask;
    }

    public Task DeleteAsync(RecurringTransactionTemplate template, CancellationToken ct)
    {
        _dbContext.RecurringTransactionTemplates.Remove(template);
        return Task.CompletedTask;
    }

    public Task SaveChangesAsync(CancellationToken ct)
    {
        return _dbContext.SaveChangesAsync(ct);
    }

    public async Task<T> ExecuteInSerializableTransactionAsync<T>(Func<Task<T>> action, CancellationToken ct)
    {
        await using var transaction = await _dbContext.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct);
        var result = await action();
        await transaction.CommitAsync(ct);
        return result;
    }
}
