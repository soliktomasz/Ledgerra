using Ledgerra.Api.Contracts;
using Ledgerra.Api.Extensions;
using Ledgerra.Domain.Accounts;
using Ledgerra.Domain.Budgets;
using Ledgerra.Domain.Transactions;
using Ledgerra.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ledgerra.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/dashboard")]
public sealed class DashboardController : ControllerBase
{
    private readonly LedgerraDbContext _dbContext;

    public DashboardController(LedgerraDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet("summary")]
    public async Task<ActionResult<DashboardSummaryResponse>> GetSummary([FromQuery] string month, CancellationToken cancellationToken)
    {
        if (!DateOnly.TryParse($"{month}-01", out var parsedMonth))
        {
            return this.ValidationError(new Dictionary<string, string[]>
            {
                ["month"] = ["Month must be provided as YYYY-MM."]
            });
        }

        var userId = User.GetRequiredUserId();
        var year = parsedMonth.Year;
        var monthNumber = parsedMonth.Month;

        var transactions = await _dbContext.Transactions
            .Where(item => item.UserId == userId && item.OccurredOnUtc.Year == year && item.OccurredOnUtc.Month == monthNumber)
            .ToListAsync(cancellationToken);

        var accounts = await _dbContext.Accounts
            .Where(item => item.UserId == userId)
            .Include(item => item.Transactions)
            .OrderBy(item => item.Name)
            .ToListAsync(cancellationToken);

        var period = await _dbContext.BudgetPeriods
            .Include(item => item.CategoryLimits)
            .ThenInclude(item => item.Category)
            .SingleOrDefaultAsync(item => item.UserId == userId && item.Year == year && item.Month == monthNumber, cancellationToken);

        var budgetRemaining = period is null
            ? 0m
            : BudgetSummaryCalculator.BuildMonthlySummary(period, transactions).TotalRemaining;

        var topCategories = transactions
            .Where(item => item.Type == TransactionType.Expense && item.CategoryId.HasValue)
            .GroupBy(item => item.CategoryId!.Value)
            .Select(group => new DashboardCategorySpendResponse(
                group.Key,
                _dbContext.Categories.Where(category => category.Id == group.Key).Select(category => category.Name).FirstOrDefault() ?? "Uncategorized",
                group.Sum(item => item.Amount)))
            .OrderByDescending(item => item.Amount)
            .Take(5)
            .ToList();

        var income = transactions.Where(item => item.Type == TransactionType.Income).Sum(item => item.Amount);
        var expenses = transactions.Where(item => item.Type == TransactionType.Expense).Sum(item => item.Amount);

        return Ok(new DashboardSummaryResponse(
            income,
            expenses,
            income - expenses,
            budgetRemaining,
            topCategories,
            accounts.Select(account => new AccountBalanceSnapshot(
                account.Id,
                account.Name,
                AccountBalanceCalculator.Calculate(account, account.Transactions))).ToList()));
    }
}
