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

public sealed record ExchangeRateResponse(Guid Id, string FromCurrencyCode, string ToCurrencyCode, string Month, decimal Rate, DateTime UpdatedAtUtc);

public sealed class UpsertExchangeRateRequest
{
    [Required, StringLength(3, MinimumLength = 3)]
    public string FromCurrencyCode { get; init; } = "USD";

    [Required, StringLength(3, MinimumLength = 3)]
    public string ToCurrencyCode { get; init; } = "USD";

    [Required, RegularExpression("^\\d{4}-\\d{2}$")]
    public string Month { get; init; } = "2026-01";

    [Range(0.00000001d, 999999999d)]
    public decimal Rate { get; init; }
}
