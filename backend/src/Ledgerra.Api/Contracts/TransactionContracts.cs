using System.ComponentModel.DataAnnotations;

namespace Ledgerra.Api.Contracts;

public sealed class CreateTransactionRequest
{
    [Required]
    public Guid AccountId { get; init; }

    public Guid? CategoryId { get; init; }

    public Guid? DestinationAccountId { get; init; }

    public Guid? SavingsGoalId { get; init; }

    [Range(0.01, 999999999)]
    public decimal Amount { get; init; }

    [Required]
    public string Type { get; init; } = string.Empty;

    [Required]
    public DateTime OccurredOnUtc { get; init; }

    [MaxLength(400)]
    public string? Note { get; init; }

    public IReadOnlyList<TransactionSplitLineRequest>? SplitLines { get; init; }
}

public sealed class UpdateTransactionRequest
{
    public Guid? CategoryId { get; init; }

    public Guid? DestinationAccountId { get; init; }

    public Guid? SavingsGoalId { get; init; }

    [Range(0.01, 999999999)]
    public decimal Amount { get; init; }

    [Required]
    public string Type { get; init; } = string.Empty;

    [Required]
    public DateTime OccurredOnUtc { get; init; }

    [MaxLength(400)]
    public string? Note { get; init; }

    public IReadOnlyList<TransactionSplitLineRequest>? SplitLines { get; init; }
}

public sealed class TransactionSplitLineRequest
{
    [Required]
    public Guid CategoryId { get; init; }

    [Range(0.01, 999999999)]
    public decimal Amount { get; init; }
}

public sealed record TransactionResponse(
    Guid Id,
    Guid AccountId,
    Guid? CategoryId,
    decimal Amount,
    string Type,
    DateTime OccurredOnUtc,
    string? Note,
    Guid? TransferGroupId,
    Guid? SavingsGoalId,
    Guid? SplitGroupId,
    Guid? ParentTransactionId);
