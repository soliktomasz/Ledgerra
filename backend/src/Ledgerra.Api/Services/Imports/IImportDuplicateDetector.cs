namespace Ledgerra.Api.Services.Imports;

public interface IImportDuplicateDetector
{
    Task<IReadOnlyList<ImportDraftReviewItem>> MarkDuplicatesAsync(
        Guid userId,
        IReadOnlyList<ImportDraftReviewItem> drafts,
        CancellationToken cancellationToken);
}
