namespace Ledgerra.Api.Contracts;

public sealed record BackupArchiveResponse(
    int Version,
    string ExportedAtUtc,
    IReadOnlyList<BackupAccountResponse> Accounts,
    IReadOnlyList<BackupCategoryResponse> Categories,
    IReadOnlyList<BackupTransactionResponse> Transactions,
    IReadOnlyList<BackupBudgetPeriodResponse> BudgetPeriods);

public sealed record BackupAccountResponse(Guid Id, string Name, string Type, string CurrencyCode, decimal OpeningBalance, bool IsActive);

public sealed record BackupCategoryResponse(Guid Id, string Name, string Kind, string Color);

public sealed record BackupTransactionResponse(
    Guid Id,
    Guid AccountId,
    Guid? CategoryId,
    decimal Amount,
    string Type,
    string OccurredOnUtc,
    string? Note,
    Guid? TransferGroupId);

public sealed record BackupBudgetPeriodResponse(Guid Id, int Year, int Month, IReadOnlyList<BackupBudgetCategoryLimitResponse> CategoryLimits);

public sealed record BackupBudgetCategoryLimitResponse(Guid Id, Guid CategoryId, decimal PlannedAmount);
