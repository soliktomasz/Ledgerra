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
        CancellationToken cancellationToken,
        IProgress<MonthlyReportAnalyzerProgress>? progress = null)
    {
        IProgress<AiReportAnalysisProgress>? aiProgress = progress is null
            ? null
            : new InlineProgress<AiReportAnalysisProgress>(item => progress.Report(new MonthlyReportAnalyzerProgress(
                item.StatusMessage,
                item.GeneratedOutputCharacters,
                item.Usage is null
                    ? null
                    : new MonthlyReportAnalyzerTokenUsage(item.Usage.PromptTokens, item.Usage.CompletionTokens, item.Usage.TotalTokens))));

        var result = await _aiReportAnalysisService.AnalyzeAsync(
            userId,
            accountId,
            provider,
            month,
            new ExtractedReport(string.Empty, string.Empty, reportContent),
            cancellationToken,
            aiProgress);

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
            result.Warnings,
            result.Usage is null
                ? null
                : new MonthlyReportAnalyzerTokenUsage(result.Usage.PromptTokens, result.Usage.CompletionTokens, result.Usage.TotalTokens));
    }

    private sealed class InlineProgress<T>(Action<T> onReport) : IProgress<T>
    {
        public void Report(T value)
        {
            onReport(value);
        }
    }
}
