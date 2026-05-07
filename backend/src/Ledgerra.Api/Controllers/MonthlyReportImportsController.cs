using Ledgerra.Api.Contracts;
using Ledgerra.Api.Extensions;
using Ledgerra.Application.Imports;
using Ledgerra.Application.Transactions;
using Ledgerra.Api.Services.Imports;
using Ledgerra.Domain.Ai;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ledgerra.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/imports/monthly-report")]
public sealed class MonthlyReportImportsController : ControllerBase
{
    private readonly AnalyzeMonthlyReportCommandHandler _analyzeMonthlyReportCommandHandler;
    private readonly CommitMonthlyReportDraftsCommandHandler _commitMonthlyReportDraftsCommandHandler;
    private readonly IReportContentExtractor _reportContentExtractor;

    public MonthlyReportImportsController(
        AnalyzeMonthlyReportCommandHandler analyzeMonthlyReportCommandHandler,
        CommitMonthlyReportDraftsCommandHandler commitMonthlyReportDraftsCommandHandler,
        IReportContentExtractor reportContentExtractor)
    {
        _analyzeMonthlyReportCommandHandler = analyzeMonthlyReportCommandHandler;
        _commitMonthlyReportDraftsCommandHandler = commitMonthlyReportDraftsCommandHandler;
        _reportContentExtractor = reportContentExtractor;
    }

    [HttpPost("analyze")]
    public async Task<ActionResult<MonthlyReportAnalysisResponse>> Analyze(
        [FromForm] Guid accountId,
        [FromForm] string month,
        [FromForm] string provider,
        [FromForm] IFormFile file,
        CancellationToken cancellationToken)
    {
        if (!AiProviderParsingExtensions.TryParseAiProvider(provider, out var parsedProvider))
        {
            return this.ValidationError(new Dictionary<string, string[]>
            {
                ["provider"] = ["Supported providers are OpenAi and Anthropic."]
            });
        }

        try
        {
            var report = await _reportContentExtractor.ExtractAsync(file, cancellationToken);
            var result = await _analyzeMonthlyReportCommandHandler.HandleAsync(
                new AnalyzeMonthlyReportCommand(
                    User.GetRequiredUserId(),
                    accountId,
                    month,
                    parsedProvider,
                    report.Content),
                cancellationToken);

            return Ok(new MonthlyReportAnalysisResponse(result.Transactions.Select(MapDraft).ToList(), result.Warnings));
        }
        catch (InvalidOperationException exception)
        {
            return exception.Message == "AI report analysis returned a malformed transaction draft."
                ? this.ValidationError(new Dictionary<string, string[]>
                {
                    ["analysis"] = [exception.Message]
                })
                : BadRequest(new ProblemDetails { Title = exception.Message });
        }
    }

    [HttpPost("commit")]
    public async Task<ActionResult<CommitMonthlyReportDraftsResponse>> Commit(
        CommitMonthlyReportDraftsRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _commitMonthlyReportDraftsCommandHandler.HandleAsync(
            new CommitMonthlyReportDraftsCommand(
                User.GetRequiredUserId(),
                request.Transactions.Select(draft => new MonthlyReportDraftInput(
                    draft.SourceId,
                    draft.AccountId,
                    draft.CategoryId,
                    draft.Amount,
                    draft.Type,
                    draft.OccurredOnUtc,
                    draft.Note)).ToList(),
                request.AcceptedDuplicateSourceIds),
            cancellationToken);

        if (result.IsNotFound)
        {
            return NotFound(new ProblemDetails { Title = result.NotFoundTitle });
        }

        if (result.HasValidationError)
        {
            return this.ValidationError(new Dictionary<string, string[]>
            {
                [result.ValidationKey!] = [result.ValidationMessage!]
            });
        }

        return Created(
            "/api/transactions",
            new CommitMonthlyReportDraftsResponse(result.Created!.Select(MapTransaction).ToList()));
    }

    private static TransactionResponse MapTransaction(TransactionDetails transaction)
    {
        return new TransactionResponse(
            transaction.Id,
            transaction.AccountId,
            transaction.CategoryId,
            transaction.Amount,
            transaction.Type.ToString(),
            transaction.OccurredOnUtc,
            transaction.Note,
            transaction.TransferGroupId,
            transaction.SavingsGoalId);
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
