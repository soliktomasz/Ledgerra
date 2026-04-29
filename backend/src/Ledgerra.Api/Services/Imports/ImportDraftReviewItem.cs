namespace Ledgerra.Api.Services.Imports;

public sealed record ImportDraftReviewItem(
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
    bool IsSelectedByDefault)
{
    public static ImportDraftReviewItem FromAnalyzedDraft(
        string sourceId,
        Guid accountId,
        Guid? categoryId,
        decimal amount,
        string type,
        DateTime occurredOnUtc,
        string? note,
        decimal confidence,
        IReadOnlyList<string> warnings)
    {
        return new ImportDraftReviewItem(
            sourceId,
            accountId,
            categoryId,
            amount,
            type,
            occurredOnUtc,
            note,
            confidence,
            warnings,
            null,
            null,
            false,
            null,
            null,
            true);
    }
}
