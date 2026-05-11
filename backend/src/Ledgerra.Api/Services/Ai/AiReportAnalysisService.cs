using Ledgerra.Api.Services.Imports;
using Ledgerra.Domain.Ai;
using Ledgerra.Infrastructure.Persistence;
using Ledgerra.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;

namespace Ledgerra.Api.Services.Ai;

public sealed class AiReportAnalysisService
{
    private readonly LedgerraDbContext _dbContext;
    private readonly ISecretProtector _secretProtector;
    private readonly AiReportAnalysisClientFactory _clientFactory;

    public AiReportAnalysisService(
        LedgerraDbContext dbContext,
        ISecretProtector secretProtector,
        AiReportAnalysisClientFactory clientFactory)
    {
        _dbContext = dbContext;
        _secretProtector = secretProtector;
        _clientFactory = clientFactory;
    }

    public async Task<AiReportAnalysisResult> AnalyzeAsync(
        Guid userId,
        Guid accountId,
        AiProvider provider,
        string month,
        ExtractedReport report,
        CancellationToken cancellationToken)
    {
        var credential = await _dbContext.AiProviderCredentials.SingleOrDefaultAsync(
            item => item.UserId == userId && item.Provider == provider,
            cancellationToken);

        if (credential is null)
        {
            throw new InvalidOperationException($"{provider} is not configured.");
        }

        var account = await _dbContext.Accounts.SingleOrDefaultAsync(
            item => item.UserId == userId && item.Id == accountId,
            cancellationToken);

        if (account is null)
        {
            throw new InvalidOperationException("Account not found.");
        }

        try
        {
            var categories = await _dbContext.Categories.Where(item => item.UserId == userId).ToListAsync(cancellationToken);
            var request = new AiReportAnalysisRequest(
                _secretProtector.Unprotect(credential.EncryptedApiKey),
                credential.BaseUrl,
                credential.Model,
                report.Content,
                month,
                [new AiAccountContext(account.Id, account.Name, account.CurrencyCode)],
                categories.Select(item => new AiCategoryContext(item.Id, item.Name, item.Kind.ToString())).ToList());

            var result = await _clientFactory.GetClient(provider).AnalyzeAsync(request, cancellationToken);
            return AiReportAnalysisResult.Normalize(result);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception exception) when (exception is InvalidOperationException or InvalidDataException or TimeoutException)
        {
            throw new InvalidOperationException(exception.Message, exception);
        }
        catch (Exception exception)
        {
            throw new InvalidOperationException($"Unable to analyze report with {provider}. Check the saved API key and try again.", exception);
        }
    }
}
