using System.Text;
using Ledgerra.Api.Services.Ai;
using Ledgerra.Api.Services.Imports;
using Microsoft.AspNetCore.Http;

namespace Ledgerra.Api.Tests;

public sealed class ReportImportServiceTests
{
    [Fact]
    public async Task CsvExtractor_ReadsCsvRowsIntoReportText()
    {
        var extractor = new CsvReportContentExtractor();
        await using var stream = new MemoryStream(Encoding.UTF8.GetBytes("Date,Description,Amount\n2026-04-10,Market,-42.17\n"));
        var file = new FormFile(stream, 0, stream.Length, "file", "statement.csv")
        {
            Headers = new HeaderDictionary(),
            ContentType = "text/csv"
        };

        var report = await extractor.ExtractAsync(file, CancellationToken.None);

        Assert.Equal("text/csv", report.ContentType);
        Assert.Contains("Date | Description | Amount", report.Content, StringComparison.Ordinal);
        Assert.Contains("2026-04-10 | Market | -42.17", report.Content, StringComparison.Ordinal);
    }

    [Fact]
    public async Task CsvExtractor_RejectsEmptyCsv()
    {
        var extractor = new CsvReportContentExtractor();
        await using var stream = new MemoryStream(Encoding.UTF8.GetBytes("   \n"));
        var file = new FormFile(stream, 0, stream.Length, "file", "statement.csv")
        {
            Headers = new HeaderDictionary(),
            ContentType = "text/csv"
        };

        var exception = await Assert.ThrowsAsync<InvalidOperationException>(() => extractor.ExtractAsync(file, CancellationToken.None));
        Assert.Contains("CSV report did not contain any readable rows", exception.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task ReportContentExtractor_RejectsConflictingExtensionAndContentType()
    {
        var extractor = new ReportContentExtractor(new CsvReportContentExtractor(), new PdfReportContentExtractor());
        await using var stream = new MemoryStream(Encoding.UTF8.GetBytes("Date,Description,Amount\n"));
        var file = new FormFile(stream, 0, stream.Length, "file", "statement.csv")
        {
            Headers = new HeaderDictionary(),
            ContentType = "application/pdf"
        };

        var exception = await Assert.ThrowsAsync<InvalidOperationException>(() => extractor.ExtractAsync(file, CancellationToken.None));
        Assert.Contains("extension and content type must match", exception.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void AiReportValidation_RejectsMalformedDrafts()
    {
        var result = AiReportAnalysisResult.Normalize(new AiReportAnalysisResult(
            [
                new AiDraftTransaction("row-1", "", null, -10m, "Expense", "not-a-date", null, 1.4m, [])
            ],
            []));

        Assert.Empty(result.Transactions);
        Assert.Contains(result.Warnings, item => item.Contains("row-1", StringComparison.Ordinal));
    }
}
