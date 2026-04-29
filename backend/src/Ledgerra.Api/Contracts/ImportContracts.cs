using System.ComponentModel.DataAnnotations;

namespace Ledgerra.Api.Contracts;

public sealed record MonthlyReportAnalysisResponse(
    IReadOnlyList<MonthlyReportDraftTransactionResponse> Transactions,
    IReadOnlyList<string> Warnings);

public sealed record MonthlyReportDraftTransactionResponse(
    string SourceId,
    Guid AccountId,
    Guid? CategoryId,
    decimal Amount,
    string Type,
    DateTime OccurredOnUtc,
    string? Note,
    decimal Confidence,
    IReadOnlyList<string> Warnings,
    Guid? AppliedRuleId,
    string? AppliedRuleName,
    bool IsLikelyDuplicate,
    Guid? DuplicateTransactionId,
    string? DuplicateReason,
    bool IsSelectedByDefault);

public sealed class CommitMonthlyReportDraftsRequest
{
    [Required, MinLength(1)]
    public IReadOnlyList<CommitMonthlyReportDraftRequest> Transactions { get; init; } = [];
}

public sealed class CommitMonthlyReportDraftRequest : IValidatableObject
{
    [Required]
    public Guid AccountId { get; init; }

    public Guid? CategoryId { get; init; }

    [Range(0.01, 999999999)]
    public decimal Amount { get; init; }

    [Required]
    public string Type { get; init; } = string.Empty;

    [Required]
    public DateTime OccurredOnUtc { get; init; }

    [MaxLength(400)]
    public string? Note { get; init; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (AccountId == Guid.Empty)
        {
            yield return new ValidationResult("AccountId must not be empty.", [nameof(AccountId)]);
        }

        if (OccurredOnUtc == default || OccurredOnUtc == DateTime.MinValue)
        {
            yield return new ValidationResult("OccurredOnUtc must be set.", [nameof(OccurredOnUtc)]);
        }
        else if (OccurredOnUtc.Kind != DateTimeKind.Utc)
        {
            yield return new ValidationResult("OccurredOnUtc must be a UTC date/time.", [nameof(OccurredOnUtc)]);
        }
    }
}

public sealed record CommitMonthlyReportDraftsResponse(IReadOnlyList<TransactionResponse> Created);
