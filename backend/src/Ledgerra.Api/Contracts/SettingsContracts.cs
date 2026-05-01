using System.ComponentModel.DataAnnotations;

namespace Ledgerra.Api.Contracts;

public sealed record ProfileResponse(string Email, string PreferredCurrencyCode, string PreferredLanguageCode);

public sealed class UpdateProfileRequest
{
    [Required, StringLength(3, MinimumLength = 3)]
    public string PreferredCurrencyCode { get; init; } = "USD";

    [Required, StringLength(10, MinimumLength = 2)]
    public string PreferredLanguageCode { get; init; } = "en";
}
