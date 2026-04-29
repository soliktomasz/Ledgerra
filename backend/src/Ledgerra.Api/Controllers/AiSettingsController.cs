using Ledgerra.Api.Contracts;
using Ledgerra.Api.Extensions;
using Ledgerra.Domain.Ai;
using Ledgerra.Infrastructure.Persistence;
using Ledgerra.Infrastructure.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ledgerra.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/settings/ai")]
public sealed class AiSettingsController : ControllerBase
{
    private readonly LedgerraDbContext _dbContext;
    private readonly ISecretProtector _secretProtector;

    public AiSettingsController(LedgerraDbContext dbContext, ISecretProtector secretProtector)
    {
        _dbContext = dbContext;
        _secretProtector = secretProtector;
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
                ["provider"] = ["Supported providers are OpenAi and Anthropic."]
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
        credential.UpdatedAtUtc = DateTime.UtcNow;

        await EnsurePreferenceAsync(userId, parsedProvider, cancellationToken);
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
                ["provider"] = ["Supported providers are OpenAi and Anthropic."]
            });
        }

        var userId = User.GetRequiredUserId();
        var credential = await _dbContext.AiProviderCredentials.SingleOrDefaultAsync(
            item => item.UserId == userId && item.Provider == parsedProvider,
            cancellationToken);

        if (credential is not null)
        {
            _dbContext.AiProviderCredentials.Remove(credential);
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
                ["provider"] = ["Supported providers are OpenAi and Anthropic."]
            });
        }

        var userId = User.GetRequiredUserId();
        await EnsurePreferenceAsync(userId, parsedProvider, cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(await BuildResponseAsync(userId, cancellationToken));
    }

    private async Task EnsurePreferenceAsync(Guid userId, AiProvider provider, CancellationToken cancellationToken)
    {
        var preference = await _dbContext.UserAiPreferences.SingleOrDefaultAsync(item => item.UserId == userId, cancellationToken);
        if (preference is null)
        {
            _dbContext.UserAiPreferences.Add(new UserAiPreference
            {
                UserId = userId,
                DefaultProvider = provider
            });
            return;
        }

        preference.DefaultProvider = provider;
        preference.UpdatedAtUtc = DateTime.UtcNow;
    }

    private async Task<AiProviderSettingsResponse> BuildResponseAsync(Guid userId, CancellationToken cancellationToken)
    {
        var credentials = await _dbContext.AiProviderCredentials.Where(item => item.UserId == userId).ToListAsync(cancellationToken);
        var preference = await _dbContext.UserAiPreferences.SingleOrDefaultAsync(item => item.UserId == userId, cancellationToken);

        return new AiProviderSettingsResponse(
            new Dictionary<string, AiProviderStatusResponse>
            {
                ["openAi"] = BuildStatus(credentials, AiProvider.OpenAi),
                ["anthropic"] = BuildStatus(credentials, AiProvider.Anthropic)
            },
            (preference?.DefaultProvider ?? AiProvider.OpenAi).ToString());
    }

    private static AiProviderStatusResponse BuildStatus(IReadOnlyCollection<AiProviderCredential> credentials, AiProvider provider)
    {
        var credential = credentials.SingleOrDefault(item => item.Provider == provider);
        return credential is null
            ? new AiProviderStatusResponse(false, null)
            : new AiProviderStatusResponse(true, credential.MaskedKey);
    }

    private static string MaskKey(string apiKey)
    {
        return apiKey.Length <= 4 ? "..." : $"...{apiKey[^4..]}";
    }
}
