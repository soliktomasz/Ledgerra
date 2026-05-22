using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace Ledgerra.Api.Tests;

public sealed class ReportingApiTests : IClassFixture<LedgerraApiFactory>
{
    private readonly LedgerraApiFactory _factory;

    public ReportingApiTests(LedgerraApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Overview_ReturnsMonthlyAnalyticsAndSingleCurrencyNetWorth()
    {
        using var client = _factory.CreateClient();
        await AuthenticateAsync(client);

        var checkingId = await CreateAccountAsync(client, "Checking", "Checking", "USD", 1000m);
        var groceriesCategoryId = await CreateCategoryAsync(client, "Groceries", "Expense");
        var salaryCategoryId = await CreateCategoryAsync(client, "Salary", "Income");

        await CreateTransactionAsync(client, checkingId, salaryCategoryId, 3000m, "Income", "2026-02-01T08:00:00Z", "February pay");
        await CreateTransactionAsync(client, checkingId, groceriesCategoryId, 200m, "Expense", "2026-02-02T08:00:00Z", "February groceries");
        await CreateTransactionAsync(client, checkingId, salaryCategoryId, 3200m, "Income", "2026-03-01T08:00:00Z", "March pay");
        await CreateTransactionAsync(client, checkingId, groceriesCategoryId, 150m, "Expense", "2026-03-05T08:00:00Z", "March groceries");

        var response = await client.GetAsync("/api/reports/overview?range=3M&endMonth=2026-04");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("3M", payload.GetProperty("rangePreset").GetString());
        Assert.Equal("2026-02", payload.GetProperty("startMonth").GetString());
        Assert.Equal("2026-04", payload.GetProperty("endMonth").GetString());

        var spendingTrend = payload.GetProperty("monthlySpendingTrend").EnumerateArray().ToArray();
        Assert.Equal(["2026-02", "2026-03", "2026-04"], spendingTrend.Select(item => item.GetProperty("month").GetString()!).ToArray());
        Assert.Equal(200m, spendingTrend[0].GetProperty("amount").GetDecimal());
        Assert.Equal(150m, spendingTrend[1].GetProperty("amount").GetDecimal());
        Assert.Equal(0m, spendingTrend[2].GetProperty("amount").GetDecimal());

        var cashFlow = payload.GetProperty("incomeVsExpense").EnumerateArray().ToArray();
        Assert.Equal(3000m, cashFlow[0].GetProperty("income").GetDecimal());
        Assert.Equal(200m, cashFlow[0].GetProperty("expenses").GetDecimal());
        Assert.Equal(2800m, cashFlow[0].GetProperty("net").GetDecimal());

        var category = Assert.Single(payload.GetProperty("categoryBreakdown").EnumerateArray());
        Assert.Equal(groceriesCategoryId, category.GetProperty("categoryId").GetGuid());
        Assert.Equal("Groceries", category.GetProperty("categoryName").GetString());
        Assert.Equal(350m, category.GetProperty("amount").GetDecimal());

        var netWorth = payload.GetProperty("netWorthHistory").EnumerateArray().ToArray();
        Assert.Equal(3800m, netWorth[0].GetProperty("netWorth").GetDecimal());
        Assert.Equal(6850m, netWorth[1].GetProperty("netWorth").GetDecimal());
        Assert.Equal(6850m, netWorth[2].GetProperty("netWorth").GetDecimal());

        Assert.Equal(-150m, payload.GetProperty("summary").GetProperty("spendingDeltaAmount").GetDecimal());
        Assert.Equal(0, payload.GetProperty("warnings").GetArrayLength());
    }

    [Fact]
    public async Task Overview_BackfillsSnapshotsAndRecomputesAfterHistoricalTransactionEdits()
    {
        using var client = _factory.CreateClient();
        await AuthenticateAsync(client);

        var checkingId = await CreateAccountAsync(client, "Checking", "Checking", "USD", 1000m);
        var groceriesCategoryId = await CreateCategoryAsync(client, "Groceries", "Expense");

        var expenseId = await CreateTransactionAsync(client, checkingId, groceriesCategoryId, 100m, "Expense", "2026-02-10T08:00:00Z", "Original groceries");

        var initialResponse = await client.GetAsync("/api/reports/overview?range=3M&endMonth=2026-04");
        Assert.Equal(HttpStatusCode.OK, initialResponse.StatusCode);
        var initialPayload = await initialResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(900m, initialPayload.GetProperty("netWorthHistory")[2].GetProperty("netWorth").GetDecimal());

        var updateResponse = await client.PutAsJsonAsync($"/api/transactions/{expenseId}", new
        {
            categoryId = groceriesCategoryId,
            amount = 250m,
            type = "Expense",
            occurredOnUtc = "2026-02-10T08:00:00Z",
            note = "Corrected groceries"
        });

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        var updatedTransaction = await updateResponse.Content.ReadFromJsonAsync<JsonElement>();
        var updatedExpenseId = updatedTransaction.GetProperty("id").GetGuid();

        var updatedResponse = await client.GetAsync("/api/reports/overview?range=3M&endMonth=2026-04");
        Assert.Equal(HttpStatusCode.OK, updatedResponse.StatusCode);
        var updatedPayload = await updatedResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(750m, updatedPayload.GetProperty("netWorthHistory")[2].GetProperty("netWorth").GetDecimal());

        var deleteResponse = await client.DeleteAsync($"/api/transactions/{updatedExpenseId}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var deletedResponse = await client.GetAsync("/api/reports/overview?range=3M&endMonth=2026-04");
        Assert.Equal(HttpStatusCode.OK, deletedResponse.StatusCode);
        var deletedPayload = await deletedResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(1000m, deletedPayload.GetProperty("netWorthHistory")[2].GetProperty("netWorth").GetDecimal());
    }

    [Fact]
    public async Task Overview_ExcludesMixedCurrencyNetWorthAndReturnsWarning()
    {
        using var client = _factory.CreateClient();
        await AuthenticateAsync(client);

        await CreateAccountAsync(client, "Checking", "Checking", "USD", 1000m);
        await CreateAccountAsync(client, "Euro Savings", "Savings", "EUR", 500m);

        var response = await client.GetAsync("/api/reports/overview?range=3M&endMonth=2026-04");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(0, payload.GetProperty("netWorthHistory").GetArrayLength());
        var warning = Assert.Single(payload.GetProperty("warnings").EnumerateArray());
        Assert.Equal("MixedCurrencyNetWorthExcluded", warning.GetProperty("code").GetString());
    }

    [Fact]
    public async Task DashboardSummary_ReturnsLightweightTrendsTeaser()
    {
        using var client = _factory.CreateClient();
        await AuthenticateAsync(client);

        var checkingId = await CreateAccountAsync(client, "Checking", "Checking", "USD", 1000m);
        var groceriesCategoryId = await CreateCategoryAsync(client, "Groceries", "Expense");

        await CreateTransactionAsync(client, checkingId, groceriesCategoryId, 120m, "Expense", "2026-03-10T08:00:00Z", "March groceries");
        await CreateTransactionAsync(client, checkingId, groceriesCategoryId, 180m, "Expense", "2026-04-10T08:00:00Z", "April groceries");

        var response = await client.GetAsync("/api/dashboard/summary?month=2026-04");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        var trends = payload.GetProperty("trends");
        Assert.Equal(60m, trends.GetProperty("spendingDeltaAmount").GetDecimal());
        Assert.Equal(50m, trends.GetProperty("spendingDeltaPercent").GetDecimal());

        var sparkline = trends.GetProperty("spendingSparkline").EnumerateArray().ToArray();
        Assert.Equal("2026-03", sparkline[^2].GetProperty("month").GetString());
        Assert.Equal(120m, sparkline[^2].GetProperty("amount").GetDecimal());
        Assert.Equal("2026-04", sparkline[^1].GetProperty("month").GetString());
        Assert.Equal(180m, sparkline[^1].GetProperty("amount").GetDecimal());
    }

    private static async Task AuthenticateAsync(HttpClient client)
    {
        var response = await client.PostAsJsonAsync("/api/auth/register", new
        {
            login = $"user-{Guid.NewGuid():N}".Substring(0, 20),
            email = $"user-{Guid.NewGuid():N}@ledgerra.local",
            password = "P@ssw0rd123!"
        });

        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", payload.GetProperty("accessToken").GetString());
    }

    private static async Task<Guid> CreateAccountAsync(HttpClient client, string name, string type, string currencyCode, decimal openingBalance)
    {
        var response = await client.PostAsJsonAsync("/api/accounts", new
        {
            name,
            type,
            currencyCode,
            openingBalance
        });

        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        return payload.GetProperty("id").GetGuid();
    }

    private static async Task<Guid> CreateCategoryAsync(HttpClient client, string name, string kind)
    {
        var response = await client.PostAsJsonAsync("/api/categories", new
        {
            name,
            kind
        });

        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        return payload.GetProperty("id").GetGuid();
    }

    private static async Task<Guid> CreateTransactionAsync(
        HttpClient client,
        Guid accountId,
        Guid? categoryId,
        decimal amount,
        string type,
        string occurredOnUtc,
        string note)
    {
        var response = await client.PostAsJsonAsync("/api/transactions", new
        {
            accountId,
            categoryId,
            amount,
            type,
            occurredOnUtc,
            note
        });

        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        return payload.GetProperty("id").GetGuid();
    }
}
