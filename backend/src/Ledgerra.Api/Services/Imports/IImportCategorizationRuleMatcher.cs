namespace Ledgerra.Api.Services.Imports;

public interface IImportCategorizationRuleMatcher
{
    Task<IReadOnlyList<ImportDraftReviewItem>> ApplyAsync(
        Guid userId,
        IReadOnlyList<ImportDraftReviewItem> drafts,
        CancellationToken cancellationToken);
}
