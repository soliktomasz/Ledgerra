using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace Ledgerra.Api.Tests;

public sealed class AccountFieldsTests : IClassFixture<LedgerraApiFactory>
{
    private readonly LedgerraApiFactory _factory;

    public AccountFieldsTests(LedgerraApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task CreateAndUpdate_RoundTripsNewAccountFields()
    {
        using var client = _factory.CreateClient();
        var auth = await RegisterAndAuthenticateAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        var createResponse = await client.PostAsJsonAsync("/api/accounts", new
        {
            name = "Retirement",
            type = "Investment",
            currencyCode = "PLN",
            openingBalance = 12500m,
            institutionName = "mBank",
            accountNumberMasked = "PL •• 8273 •• 4821",
            iconKind = "Piggy"
        });

        if (createResponse.StatusCode != HttpStatusCode.Created)
        {
            var body = await createResponse.Content.ReadAsStringAsync();
            throw new Xunit.Sdk.XunitException($"Create failed with {(int)createResponse.StatusCode}: {body}");
        }

        var createdPayload = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        var accountId = createdPayload.GetProperty("id").GetGuid();

        var getResponse = await client.GetAsync($"/api/accounts/{accountId}");
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);

        var fetched = await getResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Retirement", fetched.GetProperty("name").GetString());
        Assert.Equal("Investment", fetched.GetProperty("type").GetString());
        Assert.Equal("mBank", fetched.GetProperty("institutionName").GetString());
        Assert.Equal("PL •• 8273 •• 4821", fetched.GetProperty("accountNumberMasked").GetString());
        Assert.Equal("Piggy", fetched.GetProperty("iconKind").GetString());

        var updateResponse = await client.PutAsJsonAsync($"/api/accounts/{accountId}", new
        {
            name = "Retirement",
            type = "Investment",
            currencyCode = "PLN",
            openingBalance = 12500m,
            isActive = true,
            institutionName = "Revolut",
            accountNumberMasked = "PL •• 8273 •• 4821",
            iconKind = "Card"
        });

        if (updateResponse.StatusCode != HttpStatusCode.OK)
        {
            var body = await updateResponse.Content.ReadAsStringAsync();
            throw new Xunit.Sdk.XunitException($"Update failed with {(int)updateResponse.StatusCode}: {body}");
        }

        var afterUpdate = await client.GetFromJsonAsync<JsonElement>($"/api/accounts/{accountId}");
        Assert.Equal("Revolut", afterUpdate.GetProperty("institutionName").GetString());
        Assert.Equal("Card", afterUpdate.GetProperty("iconKind").GetString());
        Assert.Equal("PL •• 8273 •• 4821", afterUpdate.GetProperty("accountNumberMasked").GetString());
        Assert.Equal("Investment", afterUpdate.GetProperty("type").GetString());
    }

    [Fact]
    public async Task Update_WithNullIconKind_PreservesExistingIcon()
    {
        // Regression: the prior bug silently reset IconKind to "Bank" when the PUT body omitted iconKind.
        using var client = _factory.CreateClient();
        var auth = await RegisterAndAuthenticateAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        var createResponse = await client.PostAsJsonAsync("/api/accounts", new
        {
            name = "Savings",
            type = "Savings",
            currencyCode = "USD",
            openingBalance = 1000m,
            iconKind = "Piggy"
        });

        if (createResponse.StatusCode != HttpStatusCode.Created)
        {
            var body = await createResponse.Content.ReadAsStringAsync();
            throw new Xunit.Sdk.XunitException($"Create failed with {(int)createResponse.StatusCode}: {body}");
        }

        var createdPayload = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        var accountId = createdPayload.GetProperty("id").GetGuid();

        var updateResponse = await client.PutAsJsonAsync($"/api/accounts/{accountId}", new
        {
            name = "Savings",
            type = "Savings",
            currencyCode = "USD",
            openingBalance = 1000m,
            isActive = true,
            iconKind = (string?)null
        });

        if (updateResponse.StatusCode != HttpStatusCode.OK)
        {
            var body = await updateResponse.Content.ReadAsStringAsync();
            throw new Xunit.Sdk.XunitException($"Update failed with {(int)updateResponse.StatusCode}: {body}");
        }

        var afterUpdate = await client.GetFromJsonAsync<JsonElement>($"/api/accounts/{accountId}");
        Assert.Equal("Piggy", afterUpdate.GetProperty("iconKind").GetString());
    }

    [Fact]
    public async Task Update_WhenExclusionFlagsAreOmitted_PreservesExistingValues()
    {
        using var client = _factory.CreateClient();
        var auth = await RegisterAndAuthenticateAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        var createResponse = await client.PostAsJsonAsync("/api/accounts", new
        {
            name = "Retirement",
            type = "Investment",
            currencyCode = "PLN",
            openingBalance = 12500m,
            excludeFromBudget = true,
            excludeFromNetWorth = true,
            iconKind = "Piggy"
        });

        if (createResponse.StatusCode != HttpStatusCode.Created)
        {
            var body = await createResponse.Content.ReadAsStringAsync();
            throw new Xunit.Sdk.XunitException($"Create failed with {(int)createResponse.StatusCode}: {body}");
        }

        var createdPayload = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        var accountId = createdPayload.GetProperty("id").GetGuid();

        var updateResponse = await client.PutAsJsonAsync($"/api/accounts/{accountId}", new
        {
            name = "Retirement",
            type = "Investment",
            currencyCode = "PLN",
            openingBalance = 12500m,
            isActive = true,
            iconKind = "Piggy"
        });

        if (updateResponse.StatusCode != HttpStatusCode.OK)
        {
            var body = await updateResponse.Content.ReadAsStringAsync();
            throw new Xunit.Sdk.XunitException($"Update failed with {(int)updateResponse.StatusCode}: {body}");
        }

        var afterUpdate = await client.GetFromJsonAsync<JsonElement>($"/api/accounts/{accountId}");
        Assert.True(afterUpdate.GetProperty("excludeFromBudget").GetBoolean());
        Assert.True(afterUpdate.GetProperty("excludeFromNetWorth").GetBoolean());
    }

    [Fact]
    public async Task Create_WithLowercaseIconKind_RoundTripsAsCanonicalPascalCase()
    {
        using var client = _factory.CreateClient();
        var auth = await RegisterAndAuthenticateAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        var createResponse = await client.PostAsJsonAsync("/api/accounts", new
        {
            name = "Piggy bank",
            type = "Savings",
            currencyCode = "USD",
            openingBalance = 0m,
            iconKind = "piggy"
        });

        if (createResponse.StatusCode != HttpStatusCode.Created)
        {
            var body = await createResponse.Content.ReadAsStringAsync();
            throw new Xunit.Sdk.XunitException($"Create failed with {(int)createResponse.StatusCode}: {body}");
        }

        var createdPayload = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        var accountId = createdPayload.GetProperty("id").GetGuid();

        var fetched = await client.GetFromJsonAsync<JsonElement>($"/api/accounts/{accountId}");
        Assert.Equal("Piggy", fetched.GetProperty("iconKind").GetString());
    }

    private static async Task<AuthResult> RegisterAndAuthenticateAsync(HttpClient client)
    {
        var response = await client.PostAsJsonAsync("/api/auth/register", new
        {
            login = $"user-{Guid.NewGuid():N}".Substring(0, 20),
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

    private sealed record AuthResult(string AccessToken, string RefreshToken);
}
