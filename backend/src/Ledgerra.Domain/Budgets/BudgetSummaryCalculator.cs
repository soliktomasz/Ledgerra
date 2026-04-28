using Ledgerra.Domain.Transactions;

namespace Ledgerra.Domain.Budgets;

public static class BudgetSummaryCalculator
{
    public static BudgetSummary BuildMonthlySummary(BudgetPeriod period, IEnumerable<Transaction> transactions)
    {
        var categorySummaries = period.CategoryLimits
            .Select(limit =>
            {
                var spent = transactions
                    .Where(transaction =>
                        transaction.Type == TransactionType.Expense &&
                        transaction.CategoryId == limit.CategoryId &&
                        transaction.OccurredOnUtc.Year == period.Year &&
                        transaction.OccurredOnUtc.Month == period.Month)
                    .Sum(transaction => transaction.Amount);

                return new BudgetCategorySummary
                {
                    CategoryId = limit.CategoryId,
                    CategoryName = limit.Category?.Name ?? "Uncategorized",
                    Planned = limit.PlannedAmount,
                    Spent = spent,
                    Remaining = limit.PlannedAmount - spent
                };
            })
            .ToList();

        var totalPlanned = categorySummaries.Sum(item => item.Planned);
        var totalSpent = categorySummaries.Sum(item => item.Spent);

        return new BudgetSummary
        {
            TotalPlanned = totalPlanned,
            TotalSpent = totalSpent,
            TotalRemaining = totalPlanned - totalSpent,
            Categories = categorySummaries
        };
    }
}
