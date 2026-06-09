namespace Ledgerra.Api.Contracts;

public sealed record BackupArchiveResponse(
    int Version,
    string ExportedAtUtc,
    IReadOnlyList<BackupAccountResponse> Accounts,
    IReadOnlyList<BackupCategoryResponse> Categories,
    IReadOnlyList<BackupTransactionResponse> Transactions,
    IReadOnlyList<BackupBudgetPeriodResponse> BudgetPeriods,
    IReadOnlyList<BackupSavingsGoalResponse>? SavingsGoals = null);

public sealed record BackupAccountResponse(
    Guid Id,
    string Name,
    string Type,
    string CurrencyCode,
    decimal OpeningBalance,
    bool IsActive,
    string? InstitutionName = null,
    string? AccountNumberMasked = null,
    string IconKind = "Bank",
    bool ExcludeFromBudget = false,
    bool ExcludeFromNetWorth = false);

public sealed record BackupCategoryResponse(Guid Id, string Name, string Kind, string? Color);

public sealed record BackupTransactionResponse(
    Guid Id,
    Guid AccountId,
    Guid? CategoryId,
    decimal Amount,
    string Type,
    string OccurredOnUtc,
    string? Note,
    Guid? TransferGroupId,
    Guid? SplitGroupId = null,
    Guid? ParentTransactionId = null,
    Guid? SavingsGoalId = null);

public sealed record BackupBudgetPeriodResponse(Guid Id, int Year, int Month, IReadOnlyList<BackupBudgetCategoryLimitResponse> CategoryLimits);

public sealed record BackupBudgetCategoryLimitResponse(Guid Id, Guid CategoryId, decimal PlannedAmount, bool CarryOverUnspent = false);


public sealed record BackupSavingsGoalResponse(Guid Id, string Name, decimal TargetAmount, string? DeadlineUtc = null, string? CreatedAtUtc = null, string? UpdatedAtUtc = null);
