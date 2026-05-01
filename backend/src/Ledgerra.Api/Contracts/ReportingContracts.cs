namespace Ledgerra.Api.Contracts;

public sealed record ReportingOverviewResponse(
    string RangePreset,
    string StartMonth,
    string EndMonth,
    string CurrencyCode,
    ReportingSummaryResponse Summary,
    IReadOnlyList<MonthlySpendingPointResponse> MonthlySpendingTrend,
    IReadOnlyList<MonthlyCashFlowPointResponse> IncomeVsExpense,
    IReadOnlyList<CategoryBreakdownRowResponse> CategoryBreakdown,
    IReadOnlyList<NetWorthPointResponse> NetWorthHistory,
    IReadOnlyList<ReportingWarningResponse> Warnings);

public sealed record ReportingSummaryResponse(
    decimal IncomeTotal,
    decimal ExpenseTotal,
    decimal NetCashFlow,
    decimal SpendingDeltaAmount,
    decimal? SpendingDeltaPercent,
    decimal NetWorthDelta);

public sealed record MonthlySpendingPointResponse(string Month, decimal Amount);

public sealed record MonthlyCashFlowPointResponse(string Month, decimal Income, decimal Expenses, decimal Net);

public sealed record CategoryBreakdownRowResponse(Guid CategoryId, string CategoryName, decimal Amount, decimal Percentage);

public sealed record NetWorthPointResponse(string Month, decimal NetWorth, string CurrencyCode);

public sealed record ReportingWarningResponse(string Code, string Message);
