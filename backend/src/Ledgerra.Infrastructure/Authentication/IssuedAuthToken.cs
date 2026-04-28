namespace Ledgerra.Infrastructure.Authentication;

public sealed record IssuedAuthToken(string AccessToken, string RefreshToken, DateTime AccessTokenExpiresAtUtc);
