using Ledgerra.Api.Contracts;
using Ledgerra.Api.Extensions;
using Ledgerra.Api.Services.Ai;
using Ledgerra.Domain.Ai;
using Ledgerra.Infrastructure.Persistence;
using Ledgerra.Infrastructure.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace Ledgerra.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/settings/ai")]
public sealed class AiSettingsController : ControllerBase
{
    private const string OpenAiBaseUrl = "https://api.openai.com/v1";
    private static readonly IReadOnlyDictionary<AiProvider, string> ProviderResponseKeys = new Dictionary<AiProvider, string>
    {
        [AiProvider.OpenAi] = "openAi",
        [AiProvider.Anthropic] = "anthropic",
        [AiProvider.OpenAiCompatible] = "openAiCompatible"
    };

    private readonly LedgerraDbContext _dbContext;
    private readonly ISecretProtector _secretProtector;
    private readonly IHttpClientFactory _httpClientFactory;

    public AiSettingsController(LedgerraDbContext dbContext, ISecretProtector secretProtector, IHttpClientFactory httpClientFactory)
    {
        _dbContext = dbContext;
        _secretProtector = secretProtector;
        _httpClientFactory = httpClientFactory;
    }

    [HttpGet]
    public async Task<ActionResult<AiProviderSettingsResponse>> Get(CancellationToken cancellationToken)
    {
        return Ok(await BuildResponseAsync(User.GetRequiredUserId(), cancellationToken));
    }

    [HttpPut("{provider}")]
    public async Task<ActionResult<AiProviderSettingsResponse>> SaveKey(
        string provider,
        SaveAiProviderKeyRequest request,
        CancellationToken cancellationToken)
    {
        if (!AiProviderParsingExtensions.TryParseAiProvider(provider, out var parsedProvider))
        {
            return this.ValidationError(new Dictionary<string, string[]>
            {
                ["provider"] = [SupportedProviderMessage()]
            });
        }

        var trimmedKey = request.ApiKey.Trim();
        if (trimmedKey.Length == 0)
        {
            return this.ValidationError(new Dictionary<string, string[]>
            {
                ["apiKey"] = ["API key is required."]
            });
        }

        var userId = User.GetRequiredUserId();
        var normalizedBaseUrl = NormalizeProviderBaseUrl(parsedProvider, request.BaseUrl, out var baseUrlError);
        if (baseUrlError is not null)
        {
            return this.ValidationError(new Dictionary<string, string[]>
            {
                ["baseUrl"] = [baseUrlError]
            });
        }

        var requestedModel = request.Model?.Trim();
        var credential = await _dbContext.AiProviderCredentials.SingleOrDefaultAsync(
            item => item.UserId == userId && item.Provider == parsedProvider,
            cancellationToken);

        if (credential is null)
        {
            credential = new AiProviderCredential
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Provider = parsedProvider,
                CreatedAtUtc = DateTime.UtcNow
            };
            _dbContext.AiProviderCredentials.Add(credential);
        }

        credential.EncryptedApiKey = _secretProtector.Protect(trimmedKey);
        credential.MaskedKey = MaskKey(trimmedKey);
        if (credential.BaseUrl != normalizedBaseUrl && string.IsNullOrWhiteSpace(requestedModel))
        {
            credential.Model = null;
        }
        credential.BaseUrl = normalizedBaseUrl;
        if (!string.IsNullOrWhiteSpace(requestedModel))
        {
            credential.Model = requestedModel;
        }
        credential.UpdatedAtUtc = DateTime.UtcNow;

        await EnsurePreferenceAsync(userId, parsedProvider, setDefaultProvider: false, canBecomeDefault: ProviderCanBecomeDefault(parsedProvider, credential), cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(await BuildResponseAsync(userId, cancellationToken));
    }

    [HttpDelete("{provider}")]
    public async Task<ActionResult<AiProviderSettingsResponse>> DeleteKey(string provider, CancellationToken cancellationToken)
    {
        if (!AiProviderParsingExtensions.TryParseAiProvider(provider, out var parsedProvider))
        {
            return this.ValidationError(new Dictionary<string, string[]>
            {
                ["provider"] = [SupportedProviderMessage()]
            });
        }

        var userId = User.GetRequiredUserId();
        var credential = await _dbContext.AiProviderCredentials.SingleOrDefaultAsync(
            item => item.UserId == userId && item.Provider == parsedProvider,
            cancellationToken);

        if (credential is not null)
        {
            _dbContext.AiProviderCredentials.Remove(credential);
            await ResetDefaultProviderIfRemovedAsync(userId, parsedProvider, cancellationToken);
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        return Ok(await BuildResponseAsync(userId, cancellationToken));
    }

    [HttpPut("default-provider")]
    public async Task<ActionResult<AiProviderSettingsResponse>> UpdateDefaultProvider(
        UpdateDefaultAiProviderRequest request,
        CancellationToken cancellationToken)
    {
        if (!AiProviderParsingExtensions.TryParseAiProvider(request.Provider, out var parsedProvider))
        {
            return this.ValidationError(new Dictionary<string, string[]>
            {
                ["provider"] = [SupportedProviderMessage()]
            });
        }

        var userId = User.GetRequiredUserId();
        var credential = await _dbContext.AiProviderCredentials.SingleOrDefaultAsync(
            item => item.UserId == userId && item.Provider == parsedProvider,
            cancellationToken);

        if (credential is null)
        {
            return this.ValidationError(new Dictionary<string, string[]>
            {
                ["provider"] = [$"{parsedProvider} requires a saved API key before it can become the default provider."]
            });
        }

        if (!ProviderCanBecomeDefault(parsedProvider, credential))
        {
            return this.ValidationError(new Dictionary<string, string[]>
            {
                ["provider"] = [$"{parsedProvider} requires a saved base URL and model before it can become the default provider."]
            });
        }

        await EnsurePreferenceAsync(userId, parsedProvider, setDefaultProvider: true, canBecomeDefault: true, cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(await BuildResponseAsync(userId, cancellationToken));
    }

    [HttpPut("{provider}/model")]
    public async Task<ActionResult<AiProviderSettingsResponse>> UpdateModel(
        string provider,
        UpdateAiProviderModelRequest request,
        CancellationToken cancellationToken)
    {
        if (!AiProviderParsingExtensions.TryParseAiProvider(provider, out var parsedProvider))
        {
            return this.ValidationError(new Dictionary<string, string[]>
            {
                ["provider"] = [SupportedProviderMessage()]
            });
        }

        var trimmedModel = request.Model.Trim();
        if (trimmedModel.Length == 0)
        {
            return this.ValidationError(new Dictionary<string, string[]>
            {
                ["model"] = ["Model is required."]
            });
        }

        var userId = User.GetRequiredUserId();
        var credential = await _dbContext.AiProviderCredentials.SingleOrDefaultAsync(
            item => item.UserId == userId && item.Provider == parsedProvider,
            cancellationToken);

        if (credential is null)
        {
            return this.ValidationError(new Dictionary<string, string[]>
            {
                ["provider"] = [$"{parsedProvider} requires a saved API key before a model can be selected."]
            });
        }

        credential.Model = trimmedModel;
        credential.UpdatedAtUtc = DateTime.UtcNow;

        await EnsurePreferenceAsync(userId, parsedProvider, setDefaultProvider: false, canBecomeDefault: ProviderCanBecomeDefault(parsedProvider, credential), cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(await BuildResponseAsync(userId, cancellationToken));
    }

    [HttpGet("{provider}/models")]
    public async Task<ActionResult<AiProviderModelsResponse>> GetModels(string provider, CancellationToken cancellationToken)
    {
        if (!AiProviderParsingExtensions.TryParseAiProvider(provider, out var parsedProvider))
        {
            return this.ValidationError(new Dictionary<string, string[]>
            {
                ["provider"] = [SupportedProviderMessage()]
            });
        }

        var userId = User.GetRequiredUserId();
        var credential = await _dbContext.AiProviderCredentials.SingleOrDefaultAsync(
            item => item.UserId == userId && item.Provider == parsedProvider,
            cancellationToken);

        if (credential is null)
        {
            return this.ValidationError(new Dictionary<string, string[]>
            {
                ["provider"] = [$"{parsedProvider} requires a saved API key before models can be loaded."]
            });
        }

        if (parsedProvider == AiProvider.Anthropic)
        {
            return Ok(new AiProviderModelsResponse([credential.Model ?? "claude-sonnet-4-6"]));
        }

        try
        {
            return Ok(new AiProviderModelsResponse(await FetchOpenAiModelIdsAsync(parsedProvider, credential, cancellationToken)));
        }
        catch (Exception exception) when (exception is InvalidOperationException or JsonException)
        {
            return BadRequest(new ProblemDetails { Title = exception.Message });
        }
    }

    private async Task EnsurePreferenceAsync(Guid userId, AiProvider provider, bool setDefaultProvider, bool canBecomeDefault, CancellationToken cancellationToken)
    {
        var preference = await _dbContext.UserAiPreferences.SingleOrDefaultAsync(item => item.UserId == userId, cancellationToken);
        if (preference is null)
        {
            _dbContext.UserAiPreferences.Add(new UserAiPreference
            {
                UserId = userId,
                DefaultProvider = canBecomeDefault ? provider : null
            });
            return;
        }

        if (!setDefaultProvider)
        {
            return;
        }

        if (!canBecomeDefault)
        {
            return;
        }

        preference.DefaultProvider = provider;
        preference.UpdatedAtUtc = DateTime.UtcNow;
    }

    private async Task ResetDefaultProviderIfRemovedAsync(Guid userId, AiProvider removedProvider, CancellationToken cancellationToken)
    {
        var preference = await _dbContext.UserAiPreferences.SingleOrDefaultAsync(item => item.UserId == userId, cancellationToken);
        if (preference?.DefaultProvider != removedProvider)
        {
            return;
        }

        var replacement = (await _dbContext.AiProviderCredentials
            .Where(item => item.UserId == userId && item.Provider != removedProvider)
            .OrderBy(item => item.Provider)
            .ToListAsync(cancellationToken))
            .Where(item => ProviderCanBecomeDefault(item.Provider, item))
            .Select(item => (AiProvider?)item.Provider)
            .FirstOrDefault();

        preference.DefaultProvider = replacement;
        preference.UpdatedAtUtc = DateTime.UtcNow;
    }

    private async Task<AiProviderSettingsResponse> BuildResponseAsync(Guid userId, CancellationToken cancellationToken)
    {
        var credentials = await _dbContext.AiProviderCredentials.Where(item => item.UserId == userId).ToListAsync(cancellationToken);
        var preference = await _dbContext.UserAiPreferences.SingleOrDefaultAsync(item => item.UserId == userId, cancellationToken);

        return new AiProviderSettingsResponse(
            new Dictionary<string, AiProviderStatusResponse>
            {
                [ProviderResponseKeys[AiProvider.OpenAi]] = BuildStatus(credentials, AiProvider.OpenAi),
                [ProviderResponseKeys[AiProvider.Anthropic]] = BuildStatus(credentials, AiProvider.Anthropic),
                [ProviderResponseKeys[AiProvider.OpenAiCompatible]] = BuildStatus(credentials, AiProvider.OpenAiCompatible)
            },
            preference?.DefaultProvider?.ToString());
    }

    private static AiProviderStatusResponse BuildStatus(IReadOnlyCollection<AiProviderCredential> credentials, AiProvider provider)
    {
        var credential = credentials.SingleOrDefault(item => item.Provider == provider);
        return credential is null
            ? new AiProviderStatusResponse(false, null, null, null)
            : new AiProviderStatusResponse(true, credential.MaskedKey, credential.BaseUrl, credential.Model);
    }

    private static string MaskKey(string apiKey)
    {
        return apiKey.Length <= 4 ? "..." : $"...{apiKey[^4..]}";
    }

    private async Task<IReadOnlyList<string>> FetchOpenAiModelIdsAsync(
        AiProvider provider,
        AiProviderCredential credential,
        CancellationToken cancellationToken)
    {
        var baseUrl = provider == AiProvider.OpenAi
            ? OpenAiBaseUrl
            : credential.BaseUrl;

        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            throw new InvalidOperationException($"{provider} requires a base URL before models can be loaded.");
        }

        var modelsUri = new Uri($"{baseUrl.Trim().TrimEnd('/')}/models", UriKind.Absolute);
        if (provider != AiProvider.OpenAi && await EndpointValidator.ResolvesToBlockedAddressAsync(modelsUri))
        {
            throw new InvalidOperationException($"{provider} base URL resolves to a blocked address.");
        }

        using var handler = new HttpClientHandler { AllowAutoRedirect = false };
        using var httpClient = new HttpClient(handler);
        using var request = new HttpRequestMessage(HttpMethod.Get, modelsUri);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _secretProtector.Unprotect(credential.EncryptedApiKey));

        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (response.StatusCode == HttpStatusCode.Unauthorized)
        {
            throw new InvalidOperationException($"{provider} rejected the saved API key.");
        }

        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"{provider} model request failed with status {(int)response.StatusCode}.");
        }

        var json = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken);
        if (!json.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Array)
        {
            throw new InvalidOperationException($"{provider} model response did not include a data array.");
        }

        return data.EnumerateArray()
            .Select(item => item.TryGetProperty("id", out var id) ? id.GetString() : null)
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(id => id, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static bool ProviderCanBecomeDefault(AiProvider provider, AiProviderCredential credential)
    {
        return provider != AiProvider.OpenAiCompatible ||
            (!string.IsNullOrWhiteSpace(credential.BaseUrl) && !string.IsNullOrWhiteSpace(credential.Model));
    }

    private static string? NormalizeProviderBaseUrl(AiProvider provider, string? baseUrl, out string? error)
    {
        error = null;
        if (provider != AiProvider.OpenAiCompatible)
        {
            return null;
        }

        var trimmedBaseUrl = baseUrl?.Trim().TrimEnd('/');
        if (string.IsNullOrWhiteSpace(trimmedBaseUrl))
        {
            error = "OpenAI-compatible providers require a base URL, for example https://api.provider.example/v1.";
            return null;
        }

        if (!Uri.TryCreate(trimmedBaseUrl, UriKind.Absolute, out var parsedUri) ||
            (parsedUri.Scheme != Uri.UriSchemeHttps && parsedUri.Scheme != Uri.UriSchemeHttp))
        {
            error = "Base URL must be an absolute HTTP or HTTPS URL.";
            return null;
        }

        if (string.IsNullOrWhiteSpace(parsedUri.Host))
        {
            error = "Base URL must include a hostname.";
            return null;
        }

        if (EndpointValidator.IsBlockedHost(parsedUri))
        {
            error = "Base URL must not point to a local, loopback, or private network address.";
            return null;
        }

        return trimmedBaseUrl;
    }

    private static string SupportedProviderMessage()
    {
        return "Supported providers are OpenAi, Anthropic, and OpenAiCompatible.";
    }
}
