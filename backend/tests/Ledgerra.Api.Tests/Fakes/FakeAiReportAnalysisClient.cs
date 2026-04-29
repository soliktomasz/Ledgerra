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

        return Task.FromResult(new AiReportAnalysisResult(
            [
                new AiDraftTransaction(
                    "row-1",
                    request.Accounts[0].Id.ToString(),
                    Guid.TryParse(categoryId, out var parsedCategoryId) ? parsedCategoryId.ToString() : null,
                    42.17m,
                    "Expense",
                    "2026-04-10T12:00:00Z",
                    "Imported: Market",
                    0.92m,
                    [])
            ],
            []));
    }
}
