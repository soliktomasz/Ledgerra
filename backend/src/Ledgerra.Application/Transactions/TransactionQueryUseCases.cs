using Ledgerra.Domain.Transactions;

namespace Ledgerra.Application.Transactions;

public sealed record GetTransactionsQuery(
    Guid UserId,
    Guid? AccountId,
    Guid? CategoryId,
    string? Type,
    DateOnly? From,
    DateOnly? To);

public sealed record GetTransactionByIdQuery(Guid UserId, Guid TransactionId);

public interface ITransactionQueryStore
{
    Task<IReadOnlyList<Transaction>> GetAllAsync(
        Guid userId,
        Guid? accountId,
        Guid? categoryId,
        TransactionType? type,
        DateTime? fromUtc,
        DateTime? toUtc,
        CancellationToken cancellationToken);

    Task<Transaction?> GetByIdAsync(Guid userId, Guid transactionId, CancellationToken cancellationToken);
}

public sealed class GetTransactionsQueryHandler
{
    private readonly ITransactionQueryStore _transactionQueryStore;

    public GetTransactionsQueryHandler(ITransactionQueryStore transactionQueryStore)
    {
        _transactionQueryStore = transactionQueryStore;
    }

    public async Task<IReadOnlyList<TransactionDetails>> HandleAsync(GetTransactionsQuery query, CancellationToken cancellationToken)
    {
        var parsedType = TryParseTransactionType(query.Type, out var transactionType)
            ? transactionType
            : null;

        var transactions = await _transactionQueryStore.GetAllAsync(
            query.UserId,
            query.AccountId,
            query.CategoryId,
            parsedType,
            query.From?.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
            query.To?.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc),
            cancellationToken);

        return transactions.Select(MapTransaction).ToList();
    }

    private static bool TryParseTransactionType(string? type, out TransactionType? parsedType)
    {
        if (!string.IsNullOrWhiteSpace(type) && Enum.TryParse<TransactionType>(type, true, out var transactionType))
        {
            parsedType = transactionType;
            return true;
        }

        parsedType = null;
        return false;
    }

    private static TransactionDetails MapTransaction(Transaction transaction)
    {
        return new TransactionDetails(
            transaction.Id,
            transaction.AccountId,
            transaction.CategoryId,
            transaction.Amount,
            transaction.Type.ToString(),
            transaction.OccurredOnUtc,
            transaction.Note,
            transaction.TransferGroupId,
            transaction.SavingsGoalId,
            transaction.SplitGroupId,
            transaction.ParentTransactionId);
    }
}

public sealed class GetTransactionByIdQueryHandler
{
    private readonly ITransactionQueryStore _transactionQueryStore;

    public GetTransactionByIdQueryHandler(ITransactionQueryStore transactionQueryStore)
    {
        _transactionQueryStore = transactionQueryStore;
    }

    public async Task<TransactionDetails?> HandleAsync(GetTransactionByIdQuery query, CancellationToken cancellationToken)
    {
        var transaction = await _transactionQueryStore.GetByIdAsync(query.UserId, query.TransactionId, cancellationToken);
        return transaction is null
            ? null
            : new TransactionDetails(
                transaction.Id,
                transaction.AccountId,
                transaction.CategoryId,
                transaction.Amount,
                transaction.Type.ToString(),
                transaction.OccurredOnUtc,
                transaction.Note,
                transaction.TransferGroupId,
                transaction.SavingsGoalId,
                transaction.SplitGroupId,
                transaction.ParentTransactionId);
    }
}
