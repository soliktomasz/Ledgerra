using Ledgerra.Application.Imports;

namespace Ledgerra.Api.Services.Imports;

public sealed class MonthlyReportDuplicateMarkerAdapter : IMonthlyReportDuplicateMarker
{
    private readonly IImportDuplicateDetector _duplicateDetector;

    public MonthlyReportDuplicateMarkerAdapter(IImportDuplicateDetector duplicateDetector)
    {
        _duplicateDetector = duplicateDetector;
    }

    public async Task<IReadOnlyList<MonthlyReportReviewDraft>> MarkDuplicatesAsync(
        Guid userId,
        IReadOnlyList<MonthlyReportReviewDraft> drafts,
        CancellationToken cancellationToken)
    {
        var marked = await _duplicateDetector.MarkDuplicatesAsync(
            userId,
            drafts.Select(draft => new ImportDraftReviewItem(
                draft.SourceId,
                draft.AccountId,
                draft.CategoryId,
                draft.Amount,
                draft.Type,
                draft.OccurredOnUtc,
                draft.Note,
                draft.Confidence,
                draft.Warnings,
                draft.AppliedRuleId,
                draft.AppliedRuleName,
                draft.IsLikelyDuplicate,
                draft.DuplicateTransactionId,
                draft.DuplicateReason,
                draft.IsSelectedByDefault)).ToList(),
            cancellationToken);

        return marked.Select(draft => new MonthlyReportReviewDraft(
            draft.SourceId,
            draft.AccountId,
            draft.CategoryId,
            draft.Amount,
            draft.Type,
            draft.OccurredOnUtc,
            draft.Note,
            draft.Confidence,
            draft.Warnings,
            draft.AppliedRuleId,
            draft.AppliedRuleName,
            draft.IsLikelyDuplicate,
            draft.DuplicateTransactionId,
            draft.DuplicateReason,
            draft.IsSelectedByDefault)).ToList();
    }
}