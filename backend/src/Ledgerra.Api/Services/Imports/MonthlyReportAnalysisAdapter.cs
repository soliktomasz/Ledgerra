using Ledgerra.Application.Imports;
using Ledgerra.Api.Services.Ai;
using Ledgerra.Domain.Ai;

namespace Ledgerra.Api.Services.Imports;

public sealed class MonthlyReportAnalysisAdapter : IMonthlyReportAnalyzer
{
    private readonly AiReportAnalysisService _aiReportAnalysisService;

    public MonthlyReportAnalysisAdapter(AiReportAnalysisService aiReportAnalysisService)
    {
        _aiReportAnalysisService = aiReportAnalysisService;
    }

    public async Task<AiDraftAnalysisResult> AnalyzeAsync(
        Guid userId,
        Guid accountId,
        AiProvider provider,
        string month,
        string reportContent,
        CancellationToken cancellationToken)
    {
        var result = await _aiReportAnalysisService.AnalyzeAsync(
            userId,
            accountId,
            provider,
            month,
            new ExtractedReport(string.Empty, string.Empty, reportContent),
            cancellationToken);

        return new AiDraftAnalysisResult(
            result.Transactions.Select(item => new AiDraftAnalysisItem(
                item.SourceId,
                item.AccountId,
                item.CategoryId,
                item.Amount,
                item.Type,
                item.OccurredOnUtc,
                item.Note,
                item.Confidence,
                item.Warnings)).ToList(),
            result.Warnings);
    }
}