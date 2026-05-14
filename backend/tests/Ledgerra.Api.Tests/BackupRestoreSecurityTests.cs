using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace Ledgerra.Api.Tests;

public sealed class BackupRestoreSecurityTests : IClassFixture<LedgerraApiFactory>
{
    private readonly LedgerraApiFactory _factory;

    public BackupRestoreSecurityTests(LedgerraApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Restore_RejectsTransactionReferencingForeignAccountId()
    {
        using var client = _factory.CreateClient();
        var auth = await RegisterAndAuthenticateAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth);

        var archiveAccountId = Guid.NewGuid();
        var foreignAccountId = Guid.NewGuid();
        var categoryId = Guid.NewGuid();

        var archive = new
        {
            version = 2,
            exportedAtUtc = "2025-01-01T00:00:00Z",
            accounts = new[] { new { id = archiveAccountId, name = "My Account", type = "Checking", currencyCode = "USD", openingBalance = 0m, isActive = true } },
            categories = new[] { new { id = categoryId, name = "Food", kind = "Expense", color = (string?)null } },
            transactions = new[]
            {
                new
                {
                    id = Guid.NewGuid(), accountId = foreignAccountId, categoryId = (Guid?)categoryId,
                    amount = 100m, type = "Expense", occurredOnUtc = "2025-01-15T00:00:00Z",
                    note = (string?)null, transferGroupId = (Guid?)null, splitGroupId = (Guid?)null, parentTransactionId = (Guid?)null
                }
            },
            budgetPeriods = Array.Empty<object>()
        };

        var response = await client.PostAsJsonAsync("/api/backup/restore", archive);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Restore_RejectsTransactionReferencingForeignCategoryId()
    {
        using var client = _factory.CreateClient();
        var auth = await RegisterAndAuthenticateAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth);

        var accountId = Guid.NewGuid();
        var archiveCategoryId = Guid.NewGuid();
        var foreignCategoryId = Guid.NewGuid();

        var archive = new
        {
            version = 2,
            exportedAtUtc = "2025-01-01T00:00:00Z",
            accounts = new[] { new { id = accountId, name = "My Account", type = "Checking", currencyCode = "USD", openingBalance = 0m, isActive = true } },
            categories = new[] { new { id = archiveCategoryId, name = "Food", kind = "Expense", color = (string?)null } },
            transactions = new[]
            {
                new
                {
                    id = Guid.NewGuid(), accountId, categoryId = (Guid?)foreignCategoryId,
                    amount = 50m, type = "Expense", occurredOnUtc = "2025-02-01T00:00:00Z",
                    note = (string?)null, transferGroupId = (Guid?)null, splitGroupId = (Guid?)null, parentTransactionId = (Guid?)null
                }
            },
            budgetPeriods = Array.Empty<object>()
        };

        var response = await client.PostAsJsonAsync("/api/backup/restore", archive);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Restore_RejectsBudgetLimitReferencingForeignCategoryId()
    {
        using var client = _factory.CreateClient();
        var auth = await RegisterAndAuthenticateAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth);

        var accountId = Guid.NewGuid();
        var archiveCategoryId = Guid.NewGuid();
        var foreignCategoryId = Guid.NewGuid();
        var budgetPeriodId = Guid.NewGuid();

        var archive = new
        {
            version = 2,
            exportedAtUtc = "2025-01-01T00:00:00Z",
            accounts = new[] { new { id = accountId, name = "My Account", type = "Checking", currencyCode = "USD", openingBalance = 0m, isActive = true } },
            categories = new[] { new { id = archiveCategoryId, name = "Food", kind = "Expense", color = (string?)null } },
            transactions = Array.Empty<object>(),
            budgetPeriods = new[]
            {
                new
                {
                    id = budgetPeriodId, year = 2025, month = 3,
                    categoryLimits = new[] { new { id = Guid.NewGuid(), categoryId = foreignCategoryId, plannedAmount = 500m } }
                }
            }
        };

        var response = await client.PostAsJsonAsync("/api/backup/restore", archive);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Restore_AcceptsValidSelfContainedArchive()
    {
        using var client = _factory.CreateClient();
        var auth = await RegisterAndAuthenticateAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth);

        var accountId = Guid.NewGuid();
        var categoryId = Guid.NewGuid();
        var budgetPeriodId = Guid.NewGuid();

        var archive = new
        {
            version = 2,
            exportedAtUtc = "2025-01-01T00:00:00Z",
            accounts = new[] { new { id = accountId, name = "My Account", type = "Checking", currencyCode = "USD", openingBalance = 0m, isActive = true } },
            categories = new[] { new { id = categoryId, name = "Food", kind = "Expense", color = (string?)null } },
            transactions = new[]
            {
                new
                {
                    id = Guid.NewGuid(), accountId, categoryId = (Guid?)categoryId,
                    amount = 25m, type = "Expense", occurredOnUtc = "2025-01-10T00:00:00Z",
                    note = (string?)null, transferGroupId = (Guid?)null, splitGroupId = (Guid?)null, parentTransactionId = (Guid?)null
                }
            },
            budgetPeriods = new[]
            {
                new
                {
                    id = budgetPeriodId, year = 2025, month = 1,
                    categoryLimits = new[] { new { id = Guid.NewGuid(), categoryId, plannedAmount = 200m } }
                }
            }
        };

        var response = await client.PostAsJsonAsync("/api/backup/restore", archive);

        if (response.StatusCode != HttpStatusCode.NoContent)
        {
            var body = await response.Content.ReadAsStringAsync();
            throw new Xunit.Sdk.XunitException($"Expected 204 but got {(int)response.StatusCode}: {body}");
        }
    }

    private static async Task<string> RegisterAndAuthenticateAsync(HttpClient client)
    {
        var response = await client.PostAsJsonAsync("/api/auth/register", new
        {
            email = $"user-{Guid.NewGuid():N}@ledgerra.local",
            password = "P@ssw0rd123!"
        });

        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        return payload.GetProperty("accessToken").GetString()!;
    }
}
