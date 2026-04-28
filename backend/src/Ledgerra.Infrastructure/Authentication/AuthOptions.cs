namespace Ledgerra.Infrastructure.Authentication;

public sealed class AuthOptions
{
    public const string SectionName = "Auth";

    public string Issuer { get; set; } = "Ledgerra";

    public string Audience { get; set; } = "Ledgerra.Clients";

    public string SigningKey { get; set; } = "ledgerra-dev-signing-key-change-me";

    public int AccessTokenMinutes { get; set; } = 60;

    public int RefreshTokenDays { get; set; } = 30;
}
