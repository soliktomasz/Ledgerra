using System.ComponentModel.DataAnnotations;

namespace Ledgerra.Api.Contracts;

public sealed record AiProviderStatusResponse(bool IsConfigured, string? MaskedKey, string? BaseUrl, string? Model);

public sealed record AiProviderSettingsResponse(
    IReadOnlyDictionary<string, AiProviderStatusResponse> Providers,
    string? DefaultProvider);

public sealed record AiProviderModelsResponse(IReadOnlyList<string> Models);

public sealed class SaveAiProviderKeyRequest
{
    [Required, MinLength(8), MaxLength(4096)]
    public string ApiKey { get; init; } = string.Empty;

    [MaxLength(2048)]
    public string? BaseUrl { get; init; }

    [MaxLength(200)]
    public string? Model { get; init; }
}

public sealed class UpdateAiProviderModelRequest
{
    [Required, MaxLength(200)]
    public string Model { get; init; } = string.Empty;
}

public sealed class UpdateDefaultAiProviderRequest
{
    [Required]
    public string Provider { get; init; } = string.Empty;
}
