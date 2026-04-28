using Ledgerra.Domain.Auth;

namespace Ledgerra.Infrastructure.Authentication;

public interface IJwtTokenService
{
    IssuedAuthToken IssueToken(AppUser user);

    string HashRefreshToken(string refreshToken);
}
