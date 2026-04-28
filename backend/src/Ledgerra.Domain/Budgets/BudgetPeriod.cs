namespace Ledgerra.Domain.Budgets;

public sealed class BudgetPeriod
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public int Year { get; set; }

    public int Month { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public List<BudgetCategoryLimit> CategoryLimits { get; set; } = [];
}
