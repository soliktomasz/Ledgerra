using System.Globalization;

namespace Ledgerra.Api.Services.Ai;

public sealed record AiReportAnalysisRequest(
    string ProviderApiKey,
    string ReportContent,
    string Month,
    IReadOnlyList<AiAccountContext> Accounts,
    IReadOnlyList<AiCategoryContext> Categories);

public sealed record AiAccountContext(Guid Id, string Name, string CurrencyCode);

public sealed record AiCategoryContext(Guid Id, string Name, string Kind);

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

public sealed record AiReportAnalysisResult(IReadOnlyList<AiDraftTransaction> Transactions, IReadOnlyList<string> Warnings)
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

        return new AiReportAnalysisResult(accepted, warnings);
    }

    private static bool IsSupportedType(string type)
    {
        return type.Equals("Income", StringComparison.OrdinalIgnoreCase) ||
            type.Equals("Expense", StringComparison.OrdinalIgnoreCase);
    }
}
