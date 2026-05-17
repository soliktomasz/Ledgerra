using System.ComponentModel.DataAnnotations;

namespace Ledgerra.Api.Contracts;

public sealed class UpdateBudgetRequest
{
    [Required]
    public IReadOnlyList<BudgetCategoryLimitRequest> CategoryLimits { get; init; } = [];
}

public sealed class BudgetCategoryLimitRequest
{
    public Guid CategoryId { get; init; }

    [Range(0d, 999999999d)]
    public decimal PlannedAmount { get; init; }

    public bool CarryOverUnspent { get; init; }
}
