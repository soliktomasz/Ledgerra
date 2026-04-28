using System.ComponentModel.DataAnnotations;

namespace Ledgerra.Api.Contracts;

public sealed record ProfileResponse(string Email, string PreferredCurrencyCode);

public sealed class UpdateProfileRequest
{
    [Required, StringLength(3, MinimumLength = 3)]
    public string PreferredCurrencyCode { get; init; } = "USD";
}
