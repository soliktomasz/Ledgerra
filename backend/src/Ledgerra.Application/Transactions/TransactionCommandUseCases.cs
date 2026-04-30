using Ledgerra.Domain.Transactions;

namespace Ledgerra.Application.Transactions;

public sealed record CreateTransactionCommand(
    Guid UserId,
    Guid AccountId,
    Guid? CategoryId,
    Guid? DestinationAccountId,
    decimal Amount,
    string Type,
    DateTime OccurredOnUtc,
    string? Note);

public sealed record UpdateTransactionCommand(
    Guid UserId,
    Guid TransactionId,
    Guid? CategoryId,
    Guid? DestinationAccountId,
    decimal Amount,
    string Type,
    DateTime OccurredOnUtc,
    string? Note);

public sealed record DeleteTransactionCommand(Guid UserId, Guid TransactionId);

public sealed record TransactionDetails(
    Guid Id,
    Guid AccountId,
    Guid? CategoryId,
    decimal Amount,
    string Type,
    DateTime OccurredOnUtc,
    string? Note,
    Guid? TransferGroupId);

public interface ITransactionCommandStore
{
    Task<bool> AccountExistsAsync(Guid userId, Guid accountId, CancellationToken cancellationToken);

    Task<bool> CategoryExistsAsync(Guid userId, Guid categoryId, CancellationToken cancellationToken);

    Task<Transaction?> GetByIdAsync(Guid userId, Guid transactionId, CancellationToken cancellationToken);

    Task DeleteAsync(Transaction transaction, CancellationToken cancellationToken);

    Task DeleteTransferGroupAsync(Guid userId, Guid transferGroupId, CancellationToken cancellationToken);

    Task<Transaction> CreateAsync(Transaction transaction, CancellationToken cancellationToken);

    Task<Transaction> CreateTransferAsync(
        Guid userId,
        Guid sourceAccountId,
        Guid destinationAccountId,
        decimal amount,
        DateTime occurredOnUtc,
        string? note,
        CancellationToken cancellationToken);
}

public sealed class CreateTransactionCommandHandler
{
    private readonly ITransactionCommandStore _transactionCommandStore;

    public CreateTransactionCommandHandler(ITransactionCommandStore transactionCommandStore)
    {
        _transactionCommandStore = transactionCommandStore;
    }

    public async Task<TransactionCommandResult> HandleAsync(CreateTransactionCommand command, CancellationToken cancellationToken)
    {
        var validation = await ValidateAsync(
            command.UserId,
            command.AccountId,
            command.CategoryId,
            command.Type,
            command.DestinationAccountId,
            cancellationToken);

        if (validation is not null)
        {
            return validation;
        }

        if (IsTransfer(command.Type))
        {
            var transfer = await _transactionCommandStore.CreateTransferAsync(
                command.UserId,
                command.AccountId,
                command.DestinationAccountId!.Value,
                command.Amount,
                command.OccurredOnUtc,
                command.Note,
                cancellationToken);

            return TransactionCommandResult.Success(MapTransaction(transfer));
        }

        var transactionType = ParseNonTransferType(command.Type);
        var transaction = await _transactionCommandStore.CreateAsync(
            new Transaction
            {
                Id = Guid.NewGuid(),
                UserId = command.UserId,
                AccountId = command.AccountId,
                CategoryId = command.CategoryId,
                Amount = command.Amount,
                Type = transactionType,
                Note = command.Note,
                OccurredOnUtc = command.OccurredOnUtc.ToUniversalTime()
            },
            cancellationToken);

        return TransactionCommandResult.Success(MapTransaction(transaction));
    }

    private async Task<TransactionCommandResult?> ValidateAsync(
        Guid userId,
        Guid accountId,
        Guid? categoryId,
        string type,
        Guid? destinationAccountId,
        CancellationToken cancellationToken)
    {
        var accountExists = await _transactionCommandStore.AccountExistsAsync(userId, accountId, cancellationToken);
        if (!accountExists)
        {
            return TransactionCommandResult.NotFound("Account not found");
        }

        if (categoryId.HasValue)
        {
            var categoryExists = await _transactionCommandStore.CategoryExistsAsync(userId, categoryId.Value, cancellationToken);
            if (!categoryExists)
            {
                return TransactionCommandResult.NotFound("Category not found");
            }
        }

        if (IsTransfer(type))
        {
            if (!destinationAccountId.HasValue || destinationAccountId.Value == accountId)
            {
                return TransactionCommandResult.ValidationError("destinationAccountId", "Transfers require a different destination account.");
            }

            var destinationExists = await _transactionCommandStore.AccountExistsAsync(userId, destinationAccountId.Value, cancellationToken);
            if (!destinationExists)
            {
                return TransactionCommandResult.NotFound("Destination account not found");
            }

            return null;
        }

        if (!TryParseNonTransferType(type, out _))
        {
            return TransactionCommandResult.ValidationError("type", "Supported transaction types are Income, Expense, and Transfer.");
        }

        return null;
    }

    private static bool IsTransfer(string type) => type.Equals("Transfer", StringComparison.OrdinalIgnoreCase);

    private static bool TryParseNonTransferType(string type, out TransactionType parsedType)
    {
        if (Enum.TryParse<TransactionType>(type, true, out parsedType) &&
            (parsedType == TransactionType.Income || parsedType == TransactionType.Expense))
        {
            return true;
        }

        parsedType = default;
        return false;
    }

    private static TransactionType ParseNonTransferType(string type)
    {
        TryParseNonTransferType(type, out var parsedType);
        return parsedType;
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
            transaction.TransferGroupId);
    }
}

public sealed class UpdateTransactionCommandHandler
{
    private readonly ITransactionCommandStore _transactionCommandStore;
    private readonly CreateTransactionCommandHandler _createTransactionCommandHandler;

    public UpdateTransactionCommandHandler(
        ITransactionCommandStore transactionCommandStore,
        CreateTransactionCommandHandler createTransactionCommandHandler)
    {
        _transactionCommandStore = transactionCommandStore;
        _createTransactionCommandHandler = createTransactionCommandHandler;
    }

    public async Task<TransactionCommandResult> HandleAsync(UpdateTransactionCommand command, CancellationToken cancellationToken)
    {
        var existing = await _transactionCommandStore.GetByIdAsync(command.UserId, command.TransactionId, cancellationToken);
        if (existing is null)
        {
            return TransactionCommandResult.NotFound();
        }

        if (existing.TransferGroupId.HasValue)
        {
            await _transactionCommandStore.DeleteTransferGroupAsync(command.UserId, existing.TransferGroupId.Value, cancellationToken);
        }
        else
        {
            await _transactionCommandStore.DeleteAsync(existing, cancellationToken);
        }

        var createResult = await _createTransactionCommandHandler.HandleAsync(
            new CreateTransactionCommand(
                command.UserId,
                existing.AccountId,
                command.CategoryId,
                command.DestinationAccountId,
                command.Amount,
                command.Type,
                command.OccurredOnUtc,
                command.Note),
            cancellationToken);

        return createResult;
    }
}

public sealed class DeleteTransactionCommandHandler
{
    private readonly ITransactionCommandStore _transactionCommandStore;

    public DeleteTransactionCommandHandler(ITransactionCommandStore transactionCommandStore)
    {
        _transactionCommandStore = transactionCommandStore;
    }

    public async Task<TransactionDeleteResult> HandleAsync(DeleteTransactionCommand command, CancellationToken cancellationToken)
    {
        var transaction = await _transactionCommandStore.GetByIdAsync(command.UserId, command.TransactionId, cancellationToken);
        if (transaction is null)
        {
            return TransactionDeleteResult.NotFound();
        }

        if (transaction.TransferGroupId.HasValue)
        {
            await _transactionCommandStore.DeleteTransferGroupAsync(command.UserId, transaction.TransferGroupId.Value, cancellationToken);
        }
        else
        {
            await _transactionCommandStore.DeleteAsync(transaction, cancellationToken);
        }

        return TransactionDeleteResult.Success();
    }
}

public sealed class TransactionCommandResult
{
    private TransactionCommandResult(TransactionDetails? transaction, string? notFoundTitle, string? validationKey, string? validationMessage)
    {
        Transaction = transaction;
        NotFoundTitle = notFoundTitle;
        ValidationKey = validationKey;
        ValidationMessage = validationMessage;
    }

    public TransactionDetails? Transaction { get; }

    public string? NotFoundTitle { get; }

    public string? ValidationKey { get; }

    public string? ValidationMessage { get; }

    public bool IsNotFound => NotFoundTitle is not null;

    public bool HasValidationError => ValidationKey is not null;

    public static TransactionCommandResult Success(TransactionDetails transaction) => new(transaction, null, null, null);

    public static TransactionCommandResult NotFound(string title = "Transaction not found") => new(null, title, null, null);

    public static TransactionCommandResult ValidationError(string key, string message) => new(null, null, key, message);
}

public sealed class TransactionDeleteResult
{
    private TransactionDeleteResult(bool wasDeleted)
    {
        WasDeleted = wasDeleted;
    }

    public bool WasDeleted { get; }

    public static TransactionDeleteResult Success() => new(true);

    public static TransactionDeleteResult NotFound() => new(false);
}