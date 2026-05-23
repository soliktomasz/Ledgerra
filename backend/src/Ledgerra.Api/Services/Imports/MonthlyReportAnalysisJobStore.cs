using System.Collections.Concurrent;
using Ledgerra.Api.Contracts;
using Ledgerra.Api.Services.Ai;
using Ledgerra.Application.Imports;
using Ledgerra.Domain.Ai;

namespace Ledgerra.Api.Services.Imports;

public sealed class MonthlyReportAnalysisJobStore
{
    private readonly ConcurrentDictionary<Guid, MonthlyReportAnalysisJob> _jobs = new();
    private readonly IServiceScopeFactory _scopeFactory;

    public MonthlyReportAnalysisJobStore(IServiceScopeFactory scopeFactory)
    {
        _scopeFactory = scopeFactory;
    }

    public MonthlyReportAnalysisJob Start(
        Guid userId,
        Guid accountId,
        string month,
        AiProvider provider,
        string reportContent)
    {
        var now = DateTime.UtcNow;
        var job = new MonthlyReportAnalysisJob(
            Guid.NewGuid(),
            userId,
            accountId,
            month,
            provider,
            "running",
            "Queued for AI analysis.",
            null,
            null,
            null,
            null,
            null,
            now,
            now);
        _jobs[job.JobId] = job;

        _ = Task.Run(() => RunAsync(job.JobId, userId, accountId, month, provider, reportContent));

        return job;
    }

    public MonthlyReportAnalysisJob? Get(Guid userId, Guid jobId)
    {
        return _jobs.TryGetValue(jobId, out var job) && job.UserId == userId ? job : null;
    }

    public async Task<MonthlyReportAnalysisJob?> RetryParseAsync(Guid userId, Guid jobId, CancellationToken cancellationToken)
    {
        if (Get(userId, jobId) is not { RawAiOutput: { Length: > 0 } rawOutput } job)
        {
            return null;
        }

        Update(jobId, current => current with
        {
            Status = "running",
            StatusMessage = "Retrying saved AI output parse.",
            Error = null,
            UpdatedAtUtc = DateTime.UtcNow
        });

        try
        {
            var parsed = AiReportAnalysisResult.Normalize(AiReportAnalysisParser.Parse(
                rawOutput,
                "Saved AI output",
                job.Usage is null
                    ? null
                    : new AiTokenUsage(job.Usage.PromptTokens, job.Usage.CompletionTokens, job.Usage.TotalTokens)));
            var result = new AiDraftAnalysisResult(
                parsed.Transactions.Select(item => new AiDraftAnalysisItem(
                    item.SourceId,
                    item.AccountId,
                    item.CategoryId,
                    item.Amount,
                    item.Type,
                    item.OccurredOnUtc,
                    item.Note,
                    item.Confidence,
                    item.Warnings)).ToList(),
                parsed.Warnings,
                parsed.Usage is null
                    ? null
                    : new MonthlyReportAnalyzerTokenUsage(parsed.Usage.PromptTokens, parsed.Usage.CompletionTokens, parsed.Usage.TotalTokens));

            using var scope = _scopeFactory.CreateScope();
            var handler = scope.ServiceProvider.GetRequiredService<AnalyzeMonthlyReportCommandHandler>();
            var reviewed = await handler.HandleAnalysisResultAsync(
                new AnalyzeMonthlyReportCommand(job.UserId, job.AccountId, job.Month, job.Provider, string.Empty),
                result,
                cancellationToken);

            Update(jobId, current => current with
            {
                Status = "completed",
                StatusMessage = "Saved AI output parsed.",
                Analysis = new MonthlyReportAnalysisResponse(reviewed.Transactions.Select(MapDraft).ToList(), reviewed.Warnings),
                Usage = reviewed.Usage is null
                    ? current.Usage
                    : new MonthlyReportAnalysisTokenUsageResponse(reviewed.Usage.PromptTokens, reviewed.Usage.CompletionTokens, reviewed.Usage.TotalTokens),
                UpdatedAtUtc = DateTime.UtcNow
            });
        }
        catch (Exception exception) when (exception is InvalidOperationException or InvalidDataException)
        {
            Update(jobId, current => current with
            {
                Status = "failed",
                StatusMessage = "Saved AI output parse failed.",
                Error = exception.Message,
                UpdatedAtUtc = DateTime.UtcNow
            });
        }

        return Get(userId, jobId);
    }

    private async Task RunAsync(
        Guid jobId,
        Guid userId,
        Guid accountId,
        string month,
        AiProvider provider,
        string reportContent)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var handler = scope.ServiceProvider.GetRequiredService<AnalyzeMonthlyReportCommandHandler>();
            Update(jobId, job => job with { StatusMessage = "Preparing report context.", UpdatedAtUtc = DateTime.UtcNow });
            var progress = new Progress<MonthlyReportAnalyzerProgress>(item => Update(jobId, job => job with
            {
                StatusMessage = item.StatusMessage,
                GeneratedOutputCharacters = item.GeneratedOutputCharacters ?? job.GeneratedOutputCharacters,
                Usage = item.Usage is null
                    ? job.Usage
                    : new MonthlyReportAnalysisTokenUsageResponse(item.Usage.PromptTokens, item.Usage.CompletionTokens, item.Usage.TotalTokens),
                UpdatedAtUtc = DateTime.UtcNow
            }));
            var result = await handler.HandleAsync(
                new AnalyzeMonthlyReportCommand(userId, accountId, month, provider, reportContent, progress),
                CancellationToken.None);

            Update(jobId, job => job with
            {
                Status = "completed",
                StatusMessage = "Analysis completed.",
                Usage = result.Usage is null
                    ? job.Usage
                    : new MonthlyReportAnalysisTokenUsageResponse(result.Usage.PromptTokens, result.Usage.CompletionTokens, result.Usage.TotalTokens),
                Analysis = new MonthlyReportAnalysisResponse(result.Transactions.Select(MapDraft).ToList(), result.Warnings),
                UpdatedAtUtc = DateTime.UtcNow
            });
        }
        catch (AiReportAnalysisParseException exception)
        {
            Update(jobId, job => job with
            {
                Status = "failed",
                StatusMessage = "Analysis failed while parsing AI output.",
                Error = exception.Message,
                RawAiOutput = exception.RawOutput,
                GeneratedOutputCharacters = exception.RawOutput.Length,
                Usage = exception.Usage is null
                    ? job.Usage
                    : new MonthlyReportAnalysisTokenUsageResponse(exception.Usage.PromptTokens, exception.Usage.CompletionTokens, exception.Usage.TotalTokens),
                UpdatedAtUtc = DateTime.UtcNow
            });
        }
        catch (Exception exception) when (exception is InvalidOperationException or InvalidDataException or TimeoutException)
        {
            Update(jobId, job => job with
            {
                Status = "failed",
                StatusMessage = "Analysis failed.",
                Error = exception.Message,
                UpdatedAtUtc = DateTime.UtcNow
            });
        }
        catch
        {
            Update(jobId, job => job with
            {
                Status = "failed",
                StatusMessage = "Analysis failed.",
                Error = "Unable to analyze report.",
                UpdatedAtUtc = DateTime.UtcNow
            });
        }
    }

    private void Update(Guid jobId, Func<MonthlyReportAnalysisJob, MonthlyReportAnalysisJob> update)
    {
        _jobs.AddOrUpdate(jobId, _ => throw new InvalidOperationException("Analysis job was not found."), (_, job) => update(job));
    }

    private static MonthlyReportDraftTransactionResponse MapDraft(AnalyzedMonthlyReportDraft draft)
    {
        return new MonthlyReportDraftTransactionResponse(
            draft.SourceId,
            draft.AccountId,
            draft.CategoryId,
            draft.Amount,
            draft.Type,
            draft.OccurredOnUtc,
            draft.Note,
            draft.Confidence,
            draft.Warnings,
            draft.AppliedRuleId,
            draft.AppliedRuleName,
            draft.IsLikelyDuplicate,
            draft.DuplicateTransactionId,
            draft.DuplicateReason,
            draft.IsSelectedByDefault);
    }
}

public sealed record MonthlyReportAnalysisJob(
    Guid JobId,
    Guid UserId,
    Guid AccountId,
    string Month,
    AiProvider Provider,
    string Status,
    string? StatusMessage,
    int? GeneratedOutputCharacters,
    MonthlyReportAnalysisTokenUsageResponse? Usage,
    MonthlyReportAnalysisResponse? Analysis,
    string? Error,
    string? RawAiOutput,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc)
{
    public MonthlyReportAnalysisJobResponse ToResponse()
    {
        return new MonthlyReportAnalysisJobResponse(
            JobId,
            Status,
            StatusMessage,
            GeneratedOutputCharacters,
            Usage,
            Analysis,
            Error,
            !string.IsNullOrWhiteSpace(RawAiOutput),
            CreatedAtUtc,
            UpdatedAtUtc);
    }
}
