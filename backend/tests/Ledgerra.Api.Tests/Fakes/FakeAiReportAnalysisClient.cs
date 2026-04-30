using Ledgerra.Api.Services.Ai;
using Ledgerra.Domain.Ai;

namespace Ledgerra.Api.Tests.Fakes;

public sealed class FakeAiReportAnalysisClient : IAiReportAnalysisClient
{
    public FakeAiReportAnalysisClient(AiProvider provider)
    {
        Provider = provider;
    }

    public AiProvider Provider { get; }

    public Task<AiReportAnalysisResult> AnalyzeAsync(AiReportAnalysisRequest request, CancellationToken cancellationToken)
    {
        var categoryId = request.ReportContent.Split("category:", StringSplitOptions.RemoveEmptyEntries).LastOrDefault()?.Trim();
        var sourceId = request.ReportContent.Contains("source:<blank>", StringComparison.OrdinalIgnoreCase)
            ? string.Empty
            : ReadMarker(request.ReportContent, "source:") ?? "row-1";
        var note = request.ReportContent.Contains("note:<blank>", StringComparison.OrdinalIgnoreCase)
            ? string.Empty
            : ReadMarker(request.ReportContent, "note:") ?? "Imported: Market";

        var parsedCategoryIdValue = Guid.TryParse(categoryId, out var parsedCategoryId) ? parsedCategoryId.ToString() : null;
        var transactions = new List<AiDraftTransaction>
        {
            new(
                sourceId,
                request.Accounts[0].Id.ToString(),
                parsedCategoryIdValue,
                42.17m,
                "Expense",
                "2026-04-10T12:00:00Z",
                note,
                0.92m,
                [])
        };

        if (request.ReportContent.Contains("duplicate-source", StringComparison.OrdinalIgnoreCase))
        {
            transactions.Add(new AiDraftTransaction(
                sourceId,
                request.Accounts[0].Id.ToString(),
                parsedCategoryIdValue,
                24.99m,
                "Expense",
                "2026-04-11T12:00:00Z",
                "Imported: Pharmacy",
                0.9m,
                []));
        }

        return Task.FromResult(new AiReportAnalysisResult(transactions, []));
    }

    private static string? ReadMarker(string content, string marker)
    {
        var markerIndex = content.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
        if (markerIndex < 0)
        {
            return null;
        }

        return content[(markerIndex + marker.Length)..].Split('\n')[0].Trim();
    }
}
