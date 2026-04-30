using Ledgerra.Application.Imports;

namespace Ledgerra.Api.Services.Imports;

public sealed class MonthlyReportRuleMatcherAdapter : IMonthlyReportRuleMatcher
{
    private readonly IImportCategorizationRuleMatcher _categorizationRuleMatcher;

    public MonthlyReportRuleMatcherAdapter(IImportCategorizationRuleMatcher categorizationRuleMatcher)
    {
        _categorizationRuleMatcher = categorizationRuleMatcher;
    }

    public async Task<IReadOnlyList<MonthlyReportReviewDraft>> ApplyAsync(
        Guid userId,
        IReadOnlyList<MonthlyReportReviewDraft> drafts,
        CancellationToken cancellationToken)
    {
        var matched = await _categorizationRuleMatcher.ApplyAsync(
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

        return matched.Select(draft => new MonthlyReportReviewDraft(
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