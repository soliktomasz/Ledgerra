using System.ComponentModel.DataAnnotations;

namespace Ledgerra.Api.Contracts;

public sealed class CreateAccountRequest
{
    [Required, MaxLength(120)]
    public string Name { get; init; } = string.Empty;

    [Required]
    public string Type { get; init; } = string.Empty;

    [Required, StringLength(3, MinimumLength = 3)]
    public string CurrencyCode { get; init; } = "USD";

    public decimal OpeningBalance { get; init; }

    public bool ExcludeFromBudget { get; init; }

    public bool ExcludeFromNetWorth { get; init; }

    [MaxLength(120)]
    public string? InstitutionName { get; init; }

    [MaxLength(64), RegularExpression(@"^(?!.*\d{5}).*$", ErrorMessage = "Account number must be masked; raw sequences of 5+ digits are not allowed.")]
    public string? AccountNumberMasked { get; init; }

    public string? IconKind { get; init; }
}

public sealed class UpdateAccountRequest
{
    [Required, MaxLength(120)]
    public string Name { get; init; } = string.Empty;

    [Required]
    public string Type { get; init; } = string.Empty;

    [Required, StringLength(3, MinimumLength = 3)]
    public string CurrencyCode { get; init; } = "USD";

    public decimal OpeningBalance { get; init; }

    public bool IsActive { get; init; }

    public bool ExcludeFromBudget { get; init; }

    public bool ExcludeFromNetWorth { get; init; }

    [MaxLength(120)]
    public string? InstitutionName { get; init; }

    [MaxLength(64), RegularExpression(@"^(?!.*\d{5}).*$", ErrorMessage = "Account number must be masked; raw sequences of 5+ digits are not allowed.")]
    public string? AccountNumberMasked { get; init; }

    public string? IconKind { get; init; }
}

public sealed record AccountResponse(
    Guid Id,
    string Name,
    string Type,
    string CurrencyCode,
    decimal OpeningBalance,
    decimal CurrentBalance,
    bool IsActive,
    bool ExcludeFromBudget,
    bool ExcludeFromNetWorth,
    string? InstitutionName,
    string? AccountNumberMasked,
    string IconKind);
