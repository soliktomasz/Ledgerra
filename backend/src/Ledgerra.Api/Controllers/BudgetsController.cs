using Ledgerra.Api.Contracts;
using Ledgerra.Api.Extensions;
using Ledgerra.Domain.Budgets;
using Ledgerra.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ledgerra.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/budgets")]
public sealed class BudgetsController : ControllerBase
{
    private readonly LedgerraDbContext _dbContext;

    public BudgetsController(LedgerraDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet("{year:int}/{month:int}")]
    public async Task<ActionResult<BudgetSummary>> Get(int year, int month, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var period = await GetOrCreateBudgetPeriodAsync(userId, year, month, cancellationToken);
        var transactions = await _dbContext.Transactions
            .Where(item => item.UserId == userId && item.OccurredOnUtc.Year == year && item.OccurredOnUtc.Month == month)
            .ToListAsync(cancellationToken);

        return Ok(BudgetSummaryCalculator.BuildMonthlySummary(period, transactions));
    }

    [HttpPut("{year:int}/{month:int}")]
    public async Task<ActionResult<BudgetSummary>> Put(int year, int month, UpdateBudgetRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var categoryIds = request.CategoryLimits.Select(item => item.CategoryId).ToArray();
        var categories = await _dbContext.Categories
            .Where(category => category.UserId == userId && categoryIds.Contains(category.Id))
            .ToDictionaryAsync(category => category.Id, cancellationToken);

        if (categories.Count != categoryIds.Length)
        {
            return this.ValidationError(new Dictionary<string, string[]>
            {
                ["categoryLimits"] = ["One or more categories could not be found for this user."]
            });
        }

        var period = await GetOrCreateBudgetPeriodAsync(userId, year, month, cancellationToken);
        var existingLimits = await _dbContext.BudgetCategoryLimits
            .Where(item => item.BudgetPeriodId == period.Id)
            .ToListAsync(cancellationToken);

        if (existingLimits.Count > 0)
        {
            _dbContext.BudgetCategoryLimits.RemoveRange(existingLimits);
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        var newLimits = request.CategoryLimits.Select(item => new BudgetCategoryLimit
        {
            Id = Guid.NewGuid(),
            BudgetPeriodId = period.Id,
            CategoryId = item.CategoryId,
            PlannedAmount = item.PlannedAmount
        }).ToList();

        _dbContext.BudgetCategoryLimits.AddRange(newLimits);

        await _dbContext.SaveChangesAsync(cancellationToken);

        period = await _dbContext.BudgetPeriods
            .Include(item => item.CategoryLimits)
            .ThenInclude(item => item.Category)
            .SingleAsync(item => item.Id == period.Id, cancellationToken);

        var transactions = await _dbContext.Transactions
            .Where(item => item.UserId == userId && item.OccurredOnUtc.Year == year && item.OccurredOnUtc.Month == month)
            .ToListAsync(cancellationToken);

        return Ok(BudgetSummaryCalculator.BuildMonthlySummary(period, transactions));
    }

    private async Task<BudgetPeriod> GetOrCreateBudgetPeriodAsync(Guid userId, int year, int month, CancellationToken cancellationToken)
    {
        var period = await _dbContext.BudgetPeriods
            .Include(item => item.CategoryLimits)
            .ThenInclude(item => item.Category)
            .SingleOrDefaultAsync(item => item.UserId == userId && item.Year == year && item.Month == month, cancellationToken);

        if (period is not null)
        {
            return period;
        }

        period = new BudgetPeriod
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Year = year,
            Month = month
        };

        _dbContext.BudgetPeriods.Add(period);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return period;
    }
}
