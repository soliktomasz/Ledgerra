using System.ComponentModel.DataAnnotations;

namespace Ledgerra.Api.Contracts;

public sealed record SavingsGoalResponse(
    Guid Id,
    string Name,
    decimal TargetAmount,
    decimal SavedAmount,
    decimal ProgressPercent,
    DateTime? DeadlineUtc);

public sealed class CreateSavingsGoalRequest
{
    [Required]
    [MaxLength(120)]
    public string Name { get; init; } = string.Empty;

    [Range(0.01d, 999999999d)]
    public decimal TargetAmount { get; init; }

    public DateTime? DeadlineUtc { get; init; }
}

public sealed class UpdateSavingsGoalRequest : CreateSavingsGoalRequest;
