using Ledgerra.Api.Contracts;
using Ledgerra.Api.Extensions;
using Ledgerra.Application.Reporting;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ledgerra.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/reports")]
public sealed class ReportsController : ControllerBase
{
    private readonly GetReportingOverviewQueryHandler _getReportingOverviewQueryHandler;

    public ReportsController(GetReportingOverviewQueryHandler getReportingOverviewQueryHandler)
    {
        _getReportingOverviewQueryHandler = getReportingOverviewQueryHandler;
    }

    [HttpGet("overview")]
    public async Task<ActionResult<ReportingOverviewResponse>> GetOverview(
        [FromQuery] string? range,
        [FromQuery] Guid? accountId,
        [FromQuery] string? endMonth,
        CancellationToken cancellationToken)
    {
        DateOnly? parsedEndMonth = null;
        if (!string.IsNullOrWhiteSpace(endMonth))
        {
            if (!DateOnly.TryParse($"{endMonth}-01", out var parsed))
            {
                return this.ValidationError(new Dictionary<string, string[]>
                {
                    ["endMonth"] = ["End month must be provided as YYYY-MM."]
                });
            }

            parsedEndMonth = parsed;
        }

        var overview = await _getReportingOverviewQueryHandler.HandleAsync(
            new GetReportingOverviewQuery(User.GetRequiredUserId(), range, accountId, parsedEndMonth),
            cancellationToken);

        return Ok(new ReportingOverviewResponse(
            overview.RangePreset,
            overview.StartMonth,
            overview.EndMonth,
            overview.CurrencyCode,
            new ReportingSummaryResponse(
                overview.Summary.IncomeTotal,
                overview.Summary.ExpenseTotal,
                overview.Summary.NetCashFlow,
                overview.Summary.SpendingDeltaAmount,
                overview.Summary.SpendingDeltaPercent,
                overview.Summary.NetWorthDelta),
            overview.MonthlySpendingTrend
                .Select(item => new MonthlySpendingPointResponse(item.Month, item.Amount))
                .ToList(),
            overview.IncomeVsExpense
                .Select(item => new MonthlyCashFlowPointResponse(item.Month, item.Income, item.Expenses, item.Net))
                .ToList(),
            overview.CategoryBreakdown
                .Select(item => new CategoryBreakdownRowResponse(item.CategoryId, item.CategoryName, item.Amount, item.Percentage))
                .ToList(),
            overview.NetWorthHistory
                .Select(item => new NetWorthPointResponse(item.Month, item.NetWorth, item.CurrencyCode))
                .ToList(),
            overview.Warnings
                .Select(item => new ReportingWarningResponse(item.Code, item.Message))
                .ToList()));
    }
}
