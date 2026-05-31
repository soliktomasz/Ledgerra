using Ledgerra.Api.Contracts;
using Ledgerra.Api.Extensions;
using Ledgerra.Application.Dashboard;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ledgerra.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/dashboard")]
public sealed class DashboardController : ControllerBase
{
    private readonly GetDashboardSummaryQueryHandler _getDashboardSummaryQueryHandler;

    public DashboardController(GetDashboardSummaryQueryHandler getDashboardSummaryQueryHandler)
    {
        _getDashboardSummaryQueryHandler = getDashboardSummaryQueryHandler;
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

        var summary = await _getDashboardSummaryQueryHandler.HandleAsync(
            new GetDashboardSummaryQuery(userId, year, monthNumber),
            cancellationToken);

        return Ok(new DashboardSummaryResponse(
            summary.Income,
            summary.Expenses,
            summary.Net,
            summary.BudgetRemaining,
            summary.TopCategories
                .Select(item => new DashboardCategorySpendResponse(item.CategoryId, item.CategoryName, item.Amount))
                .ToList(),
            summary.Accounts
                .Select(item => new AccountBalanceSnapshot(item.AccountId, item.Name, item.Balance))
                .ToList(),
            new DashboardTrendsResponse(
                summary.Trends.SpendingDeltaAmount,
                summary.Trends.SpendingDeltaPercent,
                summary.Trends.SpendingSparkline
                    .Select(item => new DashboardSpendingSparklinePointResponse(item.Month, item.Amount))
                    .ToList()),
            summary.CurrencyCode,
            summary.Warnings
                .Select(item => new DashboardWarningResponse(item.Code, item.Message))
                .ToList()));
    }
}
