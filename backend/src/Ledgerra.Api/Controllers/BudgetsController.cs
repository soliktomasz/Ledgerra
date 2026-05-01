using Ledgerra.Api.Contracts;
using Ledgerra.Api.Extensions;
using Ledgerra.Application.Budgets;
using Ledgerra.Domain.Budgets;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ledgerra.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/budgets")]
public sealed class BudgetsController : ControllerBase
{
    private readonly GetBudgetSummaryQueryHandler _getBudgetSummaryQueryHandler;
    private readonly UpdateBudgetCommandHandler _updateBudgetCommandHandler;

    public BudgetsController(GetBudgetSummaryQueryHandler getBudgetSummaryQueryHandler, UpdateBudgetCommandHandler updateBudgetCommandHandler)
    {
        _getBudgetSummaryQueryHandler = getBudgetSummaryQueryHandler;
        _updateBudgetCommandHandler = updateBudgetCommandHandler;
    }

    [HttpGet("{year:int}/{month:int}")]
    public async Task<ActionResult<BudgetSummary>> Get(int year, int month, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var summary = await _getBudgetSummaryQueryHandler.HandleAsync(new GetBudgetSummaryQuery(userId, year, month), cancellationToken);
        return Ok(summary);
    }

    [HttpPut("{year:int}/{month:int}")]
    public async Task<ActionResult<BudgetSummary>> Put(int year, int month, UpdateBudgetRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var result = await _updateBudgetCommandHandler.HandleAsync(
            new UpdateBudgetCommand(
                userId,
                year,
                month,
                request.CategoryLimits.Select(item => new BudgetCategoryLimitInput(item.CategoryId, item.PlannedAmount)).ToList()),
            cancellationToken);

        if (result.HasValidationError)
        {
            return this.ValidationError(new Dictionary<string, string[]>
            {
                ["categoryLimits"] = [result.ValidationError!]
            });
        }

        return Ok(result.Summary);
    }
}
