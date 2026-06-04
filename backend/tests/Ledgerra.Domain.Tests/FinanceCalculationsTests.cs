using Ledgerra.Domain.Accounts;
using Ledgerra.Domain.Budgets;
using Ledgerra.Domain.Categories;
using Ledgerra.Domain.Transactions;
using Ledgerra.Domain.ExchangeRates;

namespace Ledgerra.Domain.Tests;

public sealed class FinanceCalculationsTests
{
    [Fact]
    public void CalculateBalance_IncludesIncomeAndExpenseTransactions()
    {
        var account = new Account
        {
            OpeningBalance = 1000m
        };

        var transactions = new[]
        {
            BuildTransaction(TransactionType.Income, 250m),
            BuildTransaction(TransactionType.Expense, 60m),
            BuildTransaction(TransactionType.Expense, 40m)
        };

        var balance = AccountBalanceCalculator.Calculate(account, transactions);

        Assert.Equal(1150m, balance);
    }

    [Fact]
    public void CalculateBalance_TreatsTransfersAsMoneyMovement()
    {
        var account = new Account
        {
            OpeningBalance = 900m
        };

        var transactions = new[]
        {
            BuildTransaction(TransactionType.TransferIn, 125m),
            BuildTransaction(TransactionType.TransferOut, 25m)
        };

        var balance = AccountBalanceCalculator.Calculate(account, transactions);

        Assert.Equal(1000m, balance);
    }

    [Fact]
    public void BuildMonthlyBudgetSummary_UsesExpenseTransactionsOnly()
    {
        var groceries = new Category
        {
            Id = Guid.NewGuid(),
            Name = "Groceries",
            Kind = CategoryKind.Expense
        };

        var salary = new Category
        {
            Id = Guid.NewGuid(),
            Name = "Salary",
            Kind = CategoryKind.Income
        };

        var period = new BudgetPeriod
        {
            Year = 2026,
            Month = 4,
            CategoryLimits =
            [
                new BudgetCategoryLimit
                {
                    CategoryId = groceries.Id,
                    PlannedAmount = 400m,
                    Category = groceries
                }
            ]
        };

        var transactions = new[]
        {
            BuildTransaction(TransactionType.Expense, 120m, groceries.Id, new DateTime(2026, 4, 3, 8, 0, 0, DateTimeKind.Utc)),
            BuildTransaction(TransactionType.Expense, 40m, groceries.Id, new DateTime(2026, 4, 11, 8, 0, 0, DateTimeKind.Utc)),
            BuildTransaction(TransactionType.Income, 2400m, salary.Id, new DateTime(2026, 4, 1, 8, 0, 0, DateTimeKind.Utc)),
            BuildTransaction(TransactionType.TransferOut, 100m, null, new DateTime(2026, 4, 20, 8, 0, 0, DateTimeKind.Utc))
        };

        var summary = BudgetSummaryCalculator.BuildMonthlySummary(period, transactions);

        Assert.Equal(160m, summary.TotalSpent);
        Assert.Equal(240m, summary.TotalRemaining);
        Assert.Single(summary.Categories);
        Assert.Equal("Groceries", summary.Categories[0].CategoryName);
        Assert.Equal(160m, summary.Categories[0].Spent);
        Assert.Equal(240m, summary.Categories[0].Remaining);
    }


    [Fact]
    public void Convert_UsesMonthlyManualRateAndWarnsWhenRateIsStale()
    {
        var result = FxRateConverter.Convert(100m, "EUR", "USD", new DateOnly(2026, 5, 1),
        [
            new FxConversionRate("EUR", "USD", new DateOnly(2026, 4, 1), 1.10m)
        ]);

        Assert.Equal(110m, result.Amount);
        var warning = Assert.Single(result.Warnings);
        Assert.Equal("StaleFxRate", warning.Code);
    }

    [Fact]
    public void Convert_UsesExactMonthlyManualRateWithoutWarning()
    {
        var result = FxRateConverter.Convert(100m, "EUR", "USD", new DateOnly(2026, 5, 1),
        [
            new FxConversionRate("EUR", "USD", new DateOnly(2026, 5, 1), 1.10m)
        ]);

        Assert.Equal(110m, result.Amount);
        Assert.Empty(result.Warnings);
    }

    [Fact]
    public void Convert_ReturnsZeroAndWarningWhenRateIsMissing()
    {
        var result = FxRateConverter.Convert(100m, "EUR", "USD", new DateOnly(2026, 5, 1), []);

        Assert.Equal(0m, result.Amount);
        var warning = Assert.Single(result.Warnings);
        Assert.Equal("MissingFxRate", warning.Code);
    }

    private static Transaction BuildTransaction(
        TransactionType type,
        decimal amount,
        Guid? categoryId = null,
        DateTime? occurredOnUtc = null)
    {
        return new Transaction
        {
            Id = Guid.NewGuid(),
            AccountId = Guid.NewGuid(),
            CategoryId = categoryId,
            Type = type,
            Amount = amount,
            OccurredOnUtc = occurredOnUtc ?? new DateTime(2026, 4, 1, 8, 0, 0, DateTimeKind.Utc)
        };
    }
}
