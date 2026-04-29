using System.ComponentModel.DataAnnotations;

namespace Ledgerra.Api.Contracts;

public sealed record AiProviderStatusResponse(bool IsConfigured, string? MaskedKey);

public sealed record AiProviderSettingsResponse(
    IReadOnlyDictionary<string, AiProviderStatusResponse> Providers,
    string DefaultProvider);

public sealed class SaveAiProviderKeyRequest
{
    [Required, MinLength(8), MaxLength(4096)]
    public string ApiKey { get; init; } = string.Empty;
}

public sealed class UpdateDefaultAiProviderRequest
{
    [Required]
    public string Provider { get; init; } = string.Empty;
}
