using Ledgerra.Application.Imports;

namespace Ledgerra.Api.Services.Imports;

public sealed class MonthlyReportDuplicateReviewerAdapter : IMonthlyReportDuplicateReviewer
{
    private readonly IImportDuplicateDetector _duplicateDetector;

    public MonthlyReportDuplicateReviewerAdapter(IImportDuplicateDetector duplicateDetector)
    {
        _duplicateDetector = duplicateDetector;
    }

    public async Task<IReadOnlyList<MonthlyReportDraftDuplicateReview>> MarkDuplicatesAsync(
        Guid userId,
        IReadOnlyList<MonthlyReportDraftInput> drafts,
        CancellationToken cancellationToken)
    {
        var reviewedDrafts = await _duplicateDetector.MarkDuplicatesAsync(
            userId,
            drafts.Select(draft => ImportDraftReviewItem.FromAnalyzedDraft(
                draft.SourceId,
                draft.AccountId,
                draft.CategoryId,
                draft.Amount,
                draft.Type,
                draft.OccurredOnUtc.ToUniversalTime(),
                draft.Note,
                1m,
                [])).ToList(),
            cancellationToken);

        return reviewedDrafts
            .Select(draft => new MonthlyReportDraftDuplicateReview(draft.SourceId, draft.IsLikelyDuplicate))
            .ToList();
    }
}