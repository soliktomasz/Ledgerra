using Ledgerra.Domain.Ai;

namespace Ledgerra.Api.Services.Ai;

public interface IAiReportAnalysisClient
{
    AiProvider Provider { get; }

    Task<AiReportAnalysisResult> AnalyzeAsync(
        AiReportAnalysisRequest request,
        CancellationToken cancellationToken,
        IProgress<AiReportAnalysisProgress>? progress = null);
}
