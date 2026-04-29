using Ledgerra.Api.Contracts;
using Ledgerra.Api.Extensions;
using Ledgerra.Api.Services.Ai;
using Ledgerra.Api.Services.Imports;
using Ledgerra.Domain.Transactions;
using Ledgerra.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ledgerra.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/imports/monthly-report")]
public sealed class MonthlyReportImportsController : ControllerBase
{
    private readonly LedgerraDbContext _dbContext;
    private readonly IReportContentExtractor _reportContentExtractor;
    private readonly AiReportAnalysisService _aiReportAnalysisService;

    public MonthlyReportImportsController(
        LedgerraDbContext dbContext,
        IReportContentExtractor reportContentExtractor,
        AiReportAnalysisService aiReportAnalysisService)
    {
        _dbContext = dbContext;
        _reportContentExtractor = reportContentExtractor;
        _aiReportAnalysisService = aiReportAnalysisService;
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
            var result = await _aiReportAnalysisService.AnalyzeAsync(
                User.GetRequiredUserId(),
                accountId,
                parsedProvider,
                month,
                report,
                cancellationToken);

            var transactions = result.Transactions.Select(transaction => new MonthlyReportDraftTransactionResponse(
                transaction.SourceId,
                Guid.Parse(transaction.AccountId),
                transaction.CategoryId is null ? null : Guid.Parse(transaction.CategoryId),
                transaction.Amount,
                transaction.Type,
                DateTime.Parse(transaction.OccurredOnUtc).ToUniversalTime(),
                transaction.Note,
                transaction.Confidence,
                transaction.Warnings)).ToList();

            return Ok(new MonthlyReportAnalysisResponse(transactions, result.Warnings));
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new ProblemDetails { Title = exception.Message });
        }
    }

    [HttpPost("commit")]
    public async Task<ActionResult<CommitMonthlyReportDraftsResponse>> Commit(
        CommitMonthlyReportDraftsRequest request,
        CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var transactions = new List<Transaction>();

        foreach (var draft in request.Transactions)
        {
            var validation = await ValidateDraftAsync(userId, draft, cancellationToken);
            if (validation is not null)
            {
                return validation;
            }

            EnumParsingExtensions.TryParseTransactionType(draft.Type, out var parsedType);
            transactions.Add(new Transaction
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                AccountId = draft.AccountId,
                CategoryId = draft.CategoryId,
                Amount = draft.Amount,
                Type = parsedType,
                Note = draft.Note,
                OccurredOnUtc = draft.OccurredOnUtc.ToUniversalTime()
            });
        }

        _dbContext.Transactions.AddRange(transactions);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Created("/api/transactions", new CommitMonthlyReportDraftsResponse(transactions.Select(MapTransaction).ToList()));
    }

    private async Task<ObjectResult?> ValidateDraftAsync(Guid userId, CommitMonthlyReportDraftRequest draft, CancellationToken cancellationToken)
    {
        var accountExists = await _dbContext.Accounts.AnyAsync(item => item.UserId == userId && item.Id == draft.AccountId, cancellationToken);
        if (!accountExists)
        {
            return NotFound(new ProblemDetails { Title = "Account not found" }) as ObjectResult;
        }

        if (!EnumParsingExtensions.TryParseTransactionType(draft.Type, out var parsedType) ||
            (parsedType != TransactionType.Income && parsedType != TransactionType.Expense))
        {
            return this.ValidationError(new Dictionary<string, string[]>
            {
                ["type"] = ["Imported report drafts must be Income or Expense."]
            });
        }

        if (draft.CategoryId.HasValue)
        {
            var categoryExists = await _dbContext.Categories.AnyAsync(
                item => item.UserId == userId && item.Id == draft.CategoryId.Value,
                cancellationToken);

            if (!categoryExists)
            {
                return NotFound(new ProblemDetails { Title = "Category not found" }) as ObjectResult;
            }
        }

        return null;
    }

    private static TransactionResponse MapTransaction(Transaction transaction)
    {
        return new TransactionResponse(
            transaction.Id,
            transaction.AccountId,
            transaction.CategoryId,
            transaction.Amount,
            transaction.Type.ToString(),
            transaction.OccurredOnUtc,
            transaction.Note,
            transaction.TransferGroupId);
    }
}
