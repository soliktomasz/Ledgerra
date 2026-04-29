using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;

namespace Ledgerra.Api.Tests;

public sealed class ApiWorkflowTests : IClassFixture<LedgerraApiFactory>
{
    private readonly LedgerraApiFactory _factory;

    public ApiWorkflowTests(LedgerraApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task RegisterLoginAndRefresh_ReturnTokens()
    {
        using var client = _factory.CreateClient();

        var registerResponse = await client.PostAsJsonAsync("/api/auth/register", new
        {
            email = "owner@ledgerra.local",
            password = "P@ssw0rd123!"
        });

        if (registerResponse.StatusCode != HttpStatusCode.Created)
        {
            var body = await registerResponse.Content.ReadAsStringAsync();
            throw new Xunit.Sdk.XunitException($"Expected 201 but got {(int)registerResponse.StatusCode}: {body}");
        }

        var registerPayload = await registerResponse.Content.ReadFromJsonAsync<JsonElement>();
        var refreshToken = registerPayload.GetProperty("refreshToken").GetString();

        Assert.False(string.IsNullOrWhiteSpace(registerPayload.GetProperty("accessToken").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(refreshToken));

        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new
        {
            email = "owner@ledgerra.local",
            password = "P@ssw0rd123!"
        });

        if (loginResponse.StatusCode != HttpStatusCode.OK)
        {
            var body = await loginResponse.Content.ReadAsStringAsync();
            throw new Xunit.Sdk.XunitException($"Login failed with {(int)loginResponse.StatusCode}: {body}");
        }

        var refreshResponse = await client.PostAsJsonAsync("/api/auth/refresh", new
        {
            refreshToken
        });

        if (refreshResponse.StatusCode != HttpStatusCode.OK)
        {
            var body = await refreshResponse.Content.ReadAsStringAsync();
            throw new Xunit.Sdk.XunitException($"Refresh failed with {(int)refreshResponse.StatusCode}: {body}");
        }
    }

    [Fact]
    public async Task AuthenticatedUser_CanCreateAccountsCategoriesTransactionsBudgetsAndDashboard()
    {
        using var client = _factory.CreateClient();

        var auth = await RegisterAndAuthenticateAsync(client);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        var checkingId = await CreateAccountAsync(client, "Personal Checking", "Checking", 1500m);
        var jointId = await CreateAccountAsync(client, "Shared Household", "Joint", 600m);
        var groceriesCategoryId = await CreateCategoryAsync(client, "Groceries", "Expense");
        var salaryCategoryId = await CreateCategoryAsync(client, "Salary", "Income");

        var incomeResponse = await client.PostAsJsonAsync("/api/transactions", new
        {
            accountId = checkingId,
            categoryId = salaryCategoryId,
            amount = 3200m,
            type = "Income",
            occurredOnUtc = "2026-04-01T08:00:00Z",
            note = "Monthly salary"
        });
        if (incomeResponse.StatusCode != HttpStatusCode.Created)
        {
            var body = await incomeResponse.Content.ReadAsStringAsync();
            throw new Xunit.Sdk.XunitException($"Income transaction failed with {(int)incomeResponse.StatusCode}: {body}");
        }

        var expenseResponse = await client.PostAsJsonAsync("/api/transactions", new
        {
            accountId = checkingId,
            categoryId = groceriesCategoryId,
            amount = 180m,
            type = "Expense",
            occurredOnUtc = "2026-04-05T08:00:00Z",
            note = "Weekly groceries"
        });
        if (expenseResponse.StatusCode != HttpStatusCode.Created)
        {
            var body = await expenseResponse.Content.ReadAsStringAsync();
            throw new Xunit.Sdk.XunitException($"Expense transaction failed with {(int)expenseResponse.StatusCode}: {body}");
        }

        var transferResponse = await client.PostAsJsonAsync("/api/transactions", new
        {
            accountId = checkingId,
            destinationAccountId = jointId,
            amount = 200m,
            type = "Transfer",
            occurredOnUtc = "2026-04-06T08:00:00Z",
            note = "Move to shared account"
        });
        if (transferResponse.StatusCode != HttpStatusCode.Created)
        {
            var body = await transferResponse.Content.ReadAsStringAsync();
            throw new Xunit.Sdk.XunitException($"Transfer transaction failed with {(int)transferResponse.StatusCode}: {body}");
        }

        var budgetResponse = await client.PutAsJsonAsync("/api/budgets/2026/4", new
        {
            categoryLimits = new[]
            {
                new
                {
                    categoryId = groceriesCategoryId,
                    plannedAmount = 500m
                }
            }
        });
        if (budgetResponse.StatusCode != HttpStatusCode.OK)
        {
            var body = await budgetResponse.Content.ReadAsStringAsync();
            throw new Xunit.Sdk.XunitException($"Budget update failed with {(int)budgetResponse.StatusCode}: {body}");
        }

        var dashboardResponse = await client.GetAsync("/api/dashboard/summary?month=2026-04");
        Assert.Equal(HttpStatusCode.OK, dashboardResponse.StatusCode);

        var dashboard = await dashboardResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(3200m, dashboard.GetProperty("income").GetDecimal());
        Assert.Equal(180m, dashboard.GetProperty("expenses").GetDecimal());
        Assert.Equal(3020m, dashboard.GetProperty("net").GetDecimal());

        var accountsResponse = await client.GetAsync("/api/accounts");
        var accountsPayload = await accountsResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(2, accountsPayload.GetArrayLength());

        var transactionsResponse = await client.GetAsync($"/api/transactions?accountId={checkingId}&from=2026-04-01&to=2026-04-30");
        var transactionsPayload = await transactionsResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(3, transactionsPayload.GetArrayLength());

        var budgetsSummaryResponse = await client.GetAsync("/api/budgets/2026/4");
        var budgetPayload = await budgetsSummaryResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(500m, budgetPayload.GetProperty("totalPlanned").GetDecimal());
        Assert.Equal(180m, budgetPayload.GetProperty("totalSpent").GetDecimal());
        Assert.Equal(320m, budgetPayload.GetProperty("totalRemaining").GetDecimal());
    }

    [Fact]
    public async Task AuthenticatedUser_CanUpdatePreferredCurrency()
    {
        using var client = _factory.CreateClient();

        var auth = await RegisterAndAuthenticateAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        var initialResponse = await client.GetAsync("/api/settings/profile");
        Assert.Equal(HttpStatusCode.OK, initialResponse.StatusCode);

        var initialPayload = await initialResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("USD", initialPayload.GetProperty("preferredCurrencyCode").GetString());

        var updateResponse = await client.PutAsJsonAsync("/api/settings/profile", new
        {
            preferredCurrencyCode = "eur"
        });
        if (updateResponse.StatusCode != HttpStatusCode.OK)
        {
            var body = await updateResponse.Content.ReadAsStringAsync();
            throw new Xunit.Sdk.XunitException($"Profile update failed with {(int)updateResponse.StatusCode}: {body}");
        }

        var updatePayload = await updateResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("EUR", updatePayload.GetProperty("preferredCurrencyCode").GetString());
    }

    [Fact]
    public async Task AuthenticatedUser_CanSaveAndRemoveEncryptedAiProviderKeys()
    {
        using var client = _factory.CreateClient();

        var auth = await RegisterAndAuthenticateAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        var saveResponse = await client.PutAsJsonAsync("/api/settings/ai/openai", new
        {
            apiKey = "sk-test-openai-secret-123456"
        });

        Assert.Equal(HttpStatusCode.OK, saveResponse.StatusCode);
        var savePayload = await saveResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(savePayload.GetProperty("providers").GetProperty("openAi").GetProperty("isConfigured").GetBoolean());
        Assert.Equal("OpenAi", savePayload.GetProperty("defaultProvider").GetString());
        Assert.DoesNotContain("sk-test-openai-secret-123456", savePayload.ToString(), StringComparison.Ordinal);

        var statusResponse = await client.GetAsync("/api/settings/ai");
        Assert.Equal(HttpStatusCode.OK, statusResponse.StatusCode);
        var statusPayload = await statusResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(statusPayload.GetProperty("providers").GetProperty("openAi").GetProperty("isConfigured").GetBoolean());
        Assert.Equal("...3456", statusPayload.GetProperty("providers").GetProperty("openAi").GetProperty("maskedKey").GetString());
        Assert.DoesNotContain("sk-test-openai-secret-123456", statusPayload.ToString(), StringComparison.Ordinal);

        var deleteResponse = await client.DeleteAsync("/api/settings/ai/openai");
        Assert.Equal(HttpStatusCode.OK, deleteResponse.StatusCode);
        var deletePayload = await deleteResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(deletePayload.GetProperty("providers").GetProperty("openAi").GetProperty("isConfigured").GetBoolean());
    }

    [Fact]
    public async Task AiProviderKeyUpdates_DoNotImplicitlyChangeExistingDefaultProvider()
    {
        using var client = _factory.CreateClient();

        var auth = await RegisterAndAuthenticateAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        await client.PutAsJsonAsync("/api/settings/ai/openai", new { apiKey = "sk-test-openai-secret-123456" });
        await client.PutAsJsonAsync("/api/settings/ai/anthropic", new { apiKey = "sk-test-anthropic-secret-abcdef" });
        await client.PutAsJsonAsync("/api/settings/ai/default-provider", new { provider = "Anthropic" });

        var saveResponse = await client.PutAsJsonAsync("/api/settings/ai/openai", new { apiKey = "sk-test-openai-secret-654321" });

        Assert.Equal(HttpStatusCode.OK, saveResponse.StatusCode);
        var payload = await saveResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Anthropic", payload.GetProperty("defaultProvider").GetString());
    }

    [Fact]
    public async Task AiDefaultProvider_RequiresConfiguredCredential()
    {
        using var client = _factory.CreateClient();

        var auth = await RegisterAndAuthenticateAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        var updateResponse = await client.PutAsJsonAsync("/api/settings/ai/default-provider", new
        {
            provider = "Anthropic"
        });

        Assert.Equal(HttpStatusCode.BadRequest, updateResponse.StatusCode);
    }

    [Fact]
    public async Task AiProviderKeyRemoval_ClearsDeletedDefaultProvider()
    {
        using var client = _factory.CreateClient();

        var auth = await RegisterAndAuthenticateAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        await client.PutAsJsonAsync("/api/settings/ai/openai", new { apiKey = "sk-test-openai-secret-123456" });

        var deleteResponse = await client.DeleteAsync("/api/settings/ai/openai");

        Assert.Equal(HttpStatusCode.OK, deleteResponse.StatusCode);
        var payload = await deleteResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(payload.GetProperty("providers").GetProperty("openAi").GetProperty("isConfigured").GetBoolean());
        Assert.Null(payload.GetProperty("defaultProvider").GetString());
    }

    [Fact]
    public async Task AuthenticatedUser_CanChooseDefaultAiProvider()
    {
        using var client = _factory.CreateClient();

        var auth = await RegisterAndAuthenticateAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        await client.PutAsJsonAsync("/api/settings/ai/anthropic", new { apiKey = "sk-test-anthropic-secret-abcdef" });

        var updateResponse = await client.PutAsJsonAsync("/api/settings/ai/default-provider", new
        {
            provider = "Anthropic"
        });

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        var payload = await updateResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Anthropic", payload.GetProperty("defaultProvider").GetString());
    }

    [Fact]
    public async Task AuthenticatedUser_CanManageImportRules()
    {
        using var client = _factory.CreateClient();

        var auth = await RegisterAndAuthenticateAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        var groceriesCategoryId = await CreateCategoryAsync(client, "Groceries", "Expense");

        var createResponse = await client.PostAsJsonAsync("/api/import-rules", new
        {
            name = "Market groceries",
            matchField = "Note",
            matchOperator = "Contains",
            matchValue = "Market",
            assignCategoryId = groceriesCategoryId,
            assignTransactionType = "Expense",
            priority = 10,
            isActive = true
        });

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var created = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        var ruleId = created.GetProperty("id").GetGuid();
        Assert.Equal("Market groceries", created.GetProperty("name").GetString());
        Assert.Equal("Note", created.GetProperty("matchField").GetString());
        Assert.Equal("Contains", created.GetProperty("matchOperator").GetString());
        Assert.Equal("Market", created.GetProperty("matchValue").GetString());
        Assert.Equal(groceriesCategoryId, created.GetProperty("assignCategoryId").GetGuid());
        Assert.Equal("Expense", created.GetProperty("assignTransactionType").GetString());
        Assert.Equal(10, created.GetProperty("priority").GetInt32());
        Assert.True(created.GetProperty("isActive").GetBoolean());

        var listResponse = await client.GetAsync("/api/import-rules");
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        var listed = await listResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Single(listed.EnumerateArray());

        var updateResponse = await client.PutAsJsonAsync($"/api/import-rules/{ruleId}", new
        {
            name = "Market disabled",
            matchField = "Note",
            matchOperator = "Contains",
            matchValue = "Imported: Market",
            assignCategoryId = groceriesCategoryId,
            assignTransactionType = "Expense",
            priority = 5,
            isActive = false
        });

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        var updated = await updateResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Market disabled", updated.GetProperty("name").GetString());
        Assert.False(updated.GetProperty("isActive").GetBoolean());
        Assert.Equal(5, updated.GetProperty("priority").GetInt32());

        var deleteResponse = await client.DeleteAsync($"/api/import-rules/{ruleId}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var emptyListResponse = await client.GetAsync("/api/import-rules");
        var emptyList = await emptyListResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Empty(emptyList.EnumerateArray());
    }

    [Fact]
    public async Task ImportRules_ValidateRuleShapeAndCategoryOwnership()
    {
        using var ownerClient = _factory.CreateClient();
        var ownerAuth = await RegisterAndAuthenticateAsync(ownerClient);
        ownerClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", ownerAuth.AccessToken);

        using var otherClient = _factory.CreateClient();
        var otherAuth = await RegisterAndAuthenticateAsync(otherClient);
        otherClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", otherAuth.AccessToken);

        var otherCategoryId = await CreateCategoryAsync(otherClient, "Other groceries", "Expense");

        var unsupportedFieldResponse = await ownerClient.PostAsJsonAsync("/api/import-rules", new
        {
            name = "Bad field",
            matchField = "Amount",
            matchOperator = "Contains",
            matchValue = "Market",
            assignCategoryId = otherCategoryId,
            assignTransactionType = "Expense",
            priority = 1,
            isActive = true
        });

        Assert.Equal(HttpStatusCode.BadRequest, unsupportedFieldResponse.StatusCode);

        var foreignCategoryResponse = await ownerClient.PostAsJsonAsync("/api/import-rules", new
        {
            name = "Foreign category",
            matchField = "Note",
            matchOperator = "Contains",
            matchValue = "Market",
            assignCategoryId = otherCategoryId,
            assignTransactionType = "Expense",
            priority = 1,
            isActive = true
        });

        Assert.Equal(HttpStatusCode.NotFound, foreignCategoryResponse.StatusCode);
    }

    [Fact]
    public async Task AuthenticatedUser_CanCommitReviewedMonthlyReportDrafts()
    {
        using var client = _factory.CreateClient();

        var auth = await RegisterAndAuthenticateAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        var checkingId = await CreateAccountAsync(client, "Personal Checking", "Checking", 1500m);
        var groceriesCategoryId = await CreateCategoryAsync(client, "Groceries", "Expense");

        var commitResponse = await client.PostAsJsonAsync("/api/imports/monthly-report/commit", new
        {
            transactions = new[]
            {
                new
                {
                    accountId = checkingId,
                    categoryId = groceriesCategoryId,
                    amount = 42.17m,
                    type = "Expense",
                    occurredOnUtc = "2026-04-10T12:00:00Z",
                    note = "Imported: Market"
                }
            }
        });

        Assert.Equal(HttpStatusCode.Created, commitResponse.StatusCode);
        var payload = await commitResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(1, payload.GetProperty("created").GetArrayLength());

        var transactionsResponse = await client.GetAsync($"/api/transactions?accountId={checkingId}&from=2026-04-01&to=2026-04-30");
        var transactionsPayload = await transactionsResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(1, transactionsPayload.GetArrayLength());
        Assert.Equal(42.17m, transactionsPayload[0].GetProperty("amount").GetDecimal());
    }

    [Fact]
    public async Task MonthlyReportCommit_RejectsInvalidDraftWithoutPartialSave()
    {
        using var client = _factory.CreateClient();

        var auth = await RegisterAndAuthenticateAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        var checkingId = await CreateAccountAsync(client, "Personal Checking", "Checking", 1500m);
        var groceriesCategoryId = await CreateCategoryAsync(client, "Groceries", "Expense");

        var commitResponse = await client.PostAsJsonAsync("/api/imports/monthly-report/commit", new
        {
            transactions = new[]
            {
                new
                {
                    accountId = checkingId,
                    categoryId = groceriesCategoryId,
                    amount = 15.25m,
                    type = "Expense",
                    occurredOnUtc = "2026-04-09T12:00:00Z",
                    note = "Valid draft before invalid one"
                },
                new
                {
                    accountId = checkingId,
                    categoryId = Guid.NewGuid(),
                    amount = 42.17m,
                    type = "Expense",
                    occurredOnUtc = "2026-04-10T12:00:00Z",
                    note = "Invalid category"
                }
            }
        });

        Assert.Equal(HttpStatusCode.NotFound, commitResponse.StatusCode);

        var transactionsResponse = await client.GetAsync($"/api/transactions?accountId={checkingId}");
        var transactionsPayload = await transactionsResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(0, transactionsPayload.GetArrayLength());
    }

    [Fact]
    public async Task MonthlyReportCommit_RejectsEmptyAccountAndDefaultDateBeforeProcessing()
    {
        using var client = _factory.CreateClient();

        var auth = await RegisterAndAuthenticateAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        var commitResponse = await client.PostAsJsonAsync("/api/imports/monthly-report/commit", new
        {
            transactions = new[]
            {
                new
                {
                    accountId = Guid.Empty,
                    amount = 42.17m,
                    type = "Expense",
                    occurredOnUtc = "0001-01-01T00:00:00Z",
                    note = "Invalid identifiers"
                }
            }
        });

        Assert.Equal(HttpStatusCode.BadRequest, commitResponse.StatusCode);
    }

    [Fact]
    public async Task AuthenticatedUser_CanAnalyzeCsvMonthlyReportIntoDrafts()
    {
        using var client = _factory.CreateClient();

        var auth = await RegisterAndAuthenticateAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        var checkingId = await CreateAccountAsync(client, "Personal Checking", "Checking", 1500m);
        var groceriesCategoryId = await CreateCategoryAsync(client, "Groceries", "Expense");

        await client.PutAsJsonAsync("/api/settings/ai/openai", new { apiKey = "sk-test-openai-secret-123456" });

        using var form = new MultipartFormDataContent();
        form.Add(new StringContent(checkingId.ToString()), "accountId");
        form.Add(new StringContent("2026-04"), "month");
        form.Add(new StringContent("OpenAi"), "provider");
        var fileContent = new ByteArrayContent(Encoding.UTF8.GetBytes($"Date,Description,Amount\n2026-04-10,Market,-42.17\ncategory:{groceriesCategoryId}\n"));
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("text/csv");
        form.Add(fileContent, "file", "statement.csv");

        var response = await client.PostAsync("/api/imports/monthly-report/analyze", form);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(1, payload.GetProperty("transactions").GetArrayLength());
        Assert.Equal(checkingId, payload.GetProperty("transactions")[0].GetProperty("accountId").GetGuid());
        Assert.Equal(groceriesCategoryId, payload.GetProperty("transactions")[0].GetProperty("categoryId").GetGuid());
        Assert.Equal(42.17m, payload.GetProperty("transactions")[0].GetProperty("amount").GetDecimal());
    }

    [Fact]
    public async Task MonthlyReportAnalyze_RequiresConfiguredProviderKey()
    {
        using var client = _factory.CreateClient();

        var auth = await RegisterAndAuthenticateAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        var checkingId = await CreateAccountAsync(client, "Personal Checking", "Checking", 1500m);

        using var form = new MultipartFormDataContent();
        form.Add(new StringContent(checkingId.ToString()), "accountId");
        form.Add(new StringContent("2026-04"), "month");
        form.Add(new StringContent("Anthropic"), "provider");
        form.Add(new ByteArrayContent(Encoding.UTF8.GetBytes("Date,Description,Amount\n2026-04-10,Market,-42.17\n")), "file", "statement.csv");

        var response = await client.PostAsync("/api/imports/monthly-report/analyze", form);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private static async Task<AuthResult> RegisterAndAuthenticateAsync(HttpClient client)
    {
        var response = await client.PostAsJsonAsync("/api/auth/register", new
        {
            email = $"user-{Guid.NewGuid():N}@ledgerra.local",
            password = "P@ssw0rd123!"
        });

        if (response.StatusCode != HttpStatusCode.Created)
        {
            var body = await response.Content.ReadAsStringAsync();
            throw new Xunit.Sdk.XunitException($"Registration failed with {(int)response.StatusCode}: {body}");
        }

        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();

        return new AuthResult(
            payload.GetProperty("accessToken").GetString()!,
            payload.GetProperty("refreshToken").GetString()!);
    }

    private static async Task<Guid> CreateAccountAsync(HttpClient client, string name, string type, decimal openingBalance)
    {
        var response = await client.PostAsJsonAsync("/api/accounts", new
        {
            name,
            type,
            currencyCode = "USD",
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

    private sealed record AuthResult(string AccessToken, string RefreshToken);
}
