using System.ComponentModel.DataAnnotations;

namespace Ledgerra.Api.Contracts;

public sealed record PersonalAccessTokenResponse(Guid Id, string Name, string TokenPrefix, DateTime CreatedAtUtc, DateTime? LastUsedAtUtc, DateTime? RevokedAtUtc);

public sealed record CreatePersonalAccessTokenResponse(PersonalAccessTokenResponse Token, string PlainTextToken);

public sealed class CreatePersonalAccessTokenRequest
{
    [Required, StringLength(120, MinimumLength = 3)]
    public string Name { get; init; } = string.Empty;
}
