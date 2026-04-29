namespace Ledgerra.Api.Services.Imports;

public sealed class ReportContentExtractor : IReportContentExtractor
{
    private const long MaxFileBytes = 8 * 1024 * 1024;
    private readonly CsvReportContentExtractor _csvExtractor;
    private readonly PdfReportContentExtractor _pdfExtractor;

    public ReportContentExtractor(CsvReportContentExtractor csvExtractor, PdfReportContentExtractor pdfExtractor)
    {
        _csvExtractor = csvExtractor;
        _pdfExtractor = pdfExtractor;
    }

    public Task<ExtractedReport> ExtractAsync(IFormFile file, CancellationToken cancellationToken)
    {
        if (file.Length == 0)
        {
            throw new InvalidOperationException("Report file is required.");
        }

        if (file.Length > MaxFileBytes)
        {
            throw new InvalidOperationException("Report file must be 8 MB or smaller.");
        }

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (extension == ".csv" || file.ContentType.Equals("text/csv", StringComparison.OrdinalIgnoreCase))
        {
            return _csvExtractor.ExtractAsync(file, cancellationToken);
        }

        if (extension == ".pdf" || file.ContentType.Equals("application/pdf", StringComparison.OrdinalIgnoreCase))
        {
            return _pdfExtractor.ExtractAsync(file, cancellationToken);
        }

        throw new InvalidOperationException("Supported report formats are PDF and CSV.");
    }
}
