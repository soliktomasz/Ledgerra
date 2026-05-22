using System.ComponentModel.DataAnnotations;

namespace Ledgerra.Api.Contracts;

public sealed class RegisterRequest
{
    [Required, MinLength(3), MaxLength(32), RegularExpression("^[a-zA-Z0-9._-]+$")]
    public string Login { get; init; } = string.Empty;

    public string? Email { get; init; }

    [Required, MinLength(8)]
    public string Password { get; init; } = string.Empty;
}

public sealed class LoginRequest
{
    [Required, MinLength(3), MaxLength(32), RegularExpression("^[a-zA-Z0-9._-]+$")]
    public string Login { get; init; } = string.Empty;

    [Required]
    public string Password { get; init; } = string.Empty;
}

public sealed class RefreshRequest
{
    [Required]
    public string RefreshToken { get; init; } = string.Empty;
}

public sealed record AuthResponse(Guid UserId, string Login, string Email, string AccessToken, string RefreshToken, DateTime ExpiresAtUtc);
