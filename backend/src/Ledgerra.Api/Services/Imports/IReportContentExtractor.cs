namespace Ledgerra.Api.Services.Imports;

public interface IReportContentExtractor
{
    Task<ExtractedReport> ExtractAsync(IFormFile file, CancellationToken cancellationToken);
}
