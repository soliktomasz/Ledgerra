using System.Globalization;

namespace Ledgerra.Api.Services.Ai;

public sealed record AiReportAnalysisRequest(
    string ProviderApiKey,
    string? ProviderBaseUrl,
    string? Model,
    string ReportContent,
    string Month,
    IReadOnlyList<AiAccountContext> Accounts,
    IReadOnlyList<AiCategoryContext> Categories);

public sealed record AiAccountContext(Guid Id, string Name, string CurrencyCode);

public sealed record AiCategoryContext(Guid Id, string Name, string Kind);

public sealed record AiTokenUsage(int PromptTokens, int CompletionTokens, int TotalTokens);

public sealed record AiReportAnalysisProgress(
    string StatusMessage,
    int? GeneratedOutputCharacters = null,
    AiTokenUsage? Usage = null);

public sealed class AiReportAnalysisParseException : Exception
{
    public AiReportAnalysisParseException(string message, string rawOutput, AiTokenUsage? usage, Exception innerException)
        : base(message, innerException)
    {
        RawOutput = rawOutput;
        Usage = usage;
    }

    public string RawOutput { get; }

    public AiTokenUsage? Usage { get; }
}

public sealed record AiDraftTransaction(
    string SourceId,
    string AccountId,
    string? CategoryId,
    decimal Amount,
    string Type,
    string OccurredOnUtc,
    string? Note,
    decimal Confidence,
    IReadOnlyList<string> Warnings);

public sealed record AiReportAnalysisResult(
    IReadOnlyList<AiDraftTransaction> Transactions,
    IReadOnlyList<string> Warnings,
    AiTokenUsage? Usage = null)
{
    public static AiReportAnalysisResult Normalize(AiReportAnalysisResult result)
    {
        var accepted = new List<AiDraftTransaction>();
        var warnings = result.Warnings.ToList();

        foreach (var transaction in result.Transactions)
        {
            if (!Guid.TryParse(transaction.AccountId, out _) ||
                (transaction.CategoryId is not null && !Guid.TryParse(transaction.CategoryId, out _)) ||
                transaction.Amount <= 0 ||
                transaction.Confidence is < 0 or > 1 ||
                !DateTime.TryParse(transaction.OccurredOnUtc, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out _) ||
                !IsSupportedType(transaction.Type))
            {
                warnings.Add($"Draft {transaction.SourceId} was rejected because it did not match Ledgerra transaction rules.");
                continue;
            }

            accepted.Add(transaction);
        }

        return new AiReportAnalysisResult(accepted, warnings, result.Usage);
    }

    private static bool IsSupportedType(string type)
    {
        return type.Equals("Income", StringComparison.OrdinalIgnoreCase) ||
            type.Equals("Expense", StringComparison.OrdinalIgnoreCase);
    }
}
