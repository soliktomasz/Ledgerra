using Ledgerra.Domain.Categories;

namespace Ledgerra.Domain.Budgets;

public sealed class BudgetCategoryLimit
{
    public Guid Id { get; set; }

    public Guid BudgetPeriodId { get; set; }

    public Guid CategoryId { get; set; }

    public decimal PlannedAmount { get; set; }

    public BudgetPeriod? BudgetPeriod { get; set; }

    public Category? Category { get; set; }
}
