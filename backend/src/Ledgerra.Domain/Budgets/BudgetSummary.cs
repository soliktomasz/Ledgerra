namespace Ledgerra.Domain.Budgets;

public sealed class BudgetSummary
{
    public decimal TotalPlanned { get; init; }

    public decimal TotalSpent { get; init; }

    public decimal TotalRemaining { get; init; }

    public IReadOnlyList<BudgetCategorySummary> Categories { get; init; } = [];
}

public sealed class BudgetCategorySummary
{
    public Guid CategoryId { get; init; }

    public string CategoryName { get; init; } = string.Empty;

    public decimal Planned { get; init; }

    public decimal Spent { get; init; }

    public decimal Remaining { get; init; }
}
