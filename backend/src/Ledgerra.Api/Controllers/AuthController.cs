using System.ComponentModel.DataAnnotations;
using Ledgerra.Api.Contracts;
using Ledgerra.Domain.Auth;
using Ledgerra.Infrastructure.Authentication;
using Ledgerra.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Ledgerra.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    private static readonly EmailAddressAttribute EmailAddressValidator = new();

    private readonly LedgerraDbContext _dbContext;
    private readonly IPasswordService _passwordService;
    private readonly IJwtTokenService _jwtTokenService;
    private readonly AuthOptions _authOptions;

    public AuthController(
        LedgerraDbContext dbContext,
        IPasswordService passwordService,
        IJwtTokenService jwtTokenService,
        IOptions<AuthOptions> authOptions)
    {
        _dbContext = dbContext;
        _passwordService = passwordService;
        _jwtTokenService = jwtTokenService;
        _authOptions = authOptions.Value;
    }

    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request, CancellationToken cancellationToken)
    {
        var normalizedLogin = request.Login.Trim().ToLowerInvariant();
        var normalizedEmail = request.Email?.Trim().ToLowerInvariant() ?? string.Empty;
        if (!string.IsNullOrWhiteSpace(normalizedEmail) && !EmailAddressValidator.IsValid(normalizedEmail))
        {
            return BadRequest(new ValidationProblemDetails(new Dictionary<string, string[]>
            {
                ["Email"] = ["The Email field is not a valid e-mail address."]
            }));
        }

        var existingLogin = await _dbContext.Users.AnyAsync(user => user.Login == normalizedLogin, cancellationToken);
        if (existingLogin)
        {
            return Conflict(new ProblemDetails
            {
                Title = "Login already taken",
                Detail = "Please choose another login."
            });
        }

        if (!string.IsNullOrWhiteSpace(normalizedEmail) &&
            await _dbContext.Users.AnyAsync(user => user.Email == normalizedEmail, cancellationToken))
        {
            return Conflict(new ProblemDetails
            {
                Title = "Email already registered",
                Detail = "A user with this email already exists."
            });
        }

        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            Login = normalizedLogin,
            Email = normalizedEmail
        };
        user.PasswordHash = _passwordService.Hash(request.Password);

        var issuedToken = _jwtTokenService.IssueToken(user);
        var refreshToken = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = _jwtTokenService.HashRefreshToken(issuedToken.RefreshToken),
            ExpiresAtUtc = DateTime.UtcNow.AddDays(_authOptions.RefreshTokenDays)
        };

        user.RefreshTokens.Add(refreshToken);

        _dbContext.Users.Add(user);
        _dbContext.Categories.AddRange(DefaultCategorySeed.BuildForUser(user));
        await _dbContext.SaveChangesAsync(cancellationToken);

        return StatusCode(StatusCodes.Status201Created, new AuthResponse(user.Id, user.Login, user.Email, issuedToken.AccessToken, issuedToken.RefreshToken, issuedToken.AccessTokenExpiresAtUtc));
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request, CancellationToken cancellationToken)
    {
        var normalizedLogin = request.Login.Trim().ToLowerInvariant();
        var user = await _dbContext.Users.Include(item => item.RefreshTokens).SingleOrDefaultAsync(item => item.Login == normalizedLogin, cancellationToken);
        if (user is null)
        {
            return Unauthorized();
        }

        if (!_passwordService.Verify(request.Password, user.PasswordHash))
        {
            return Unauthorized();
        }

        var response = await RotateRefreshTokenAsync(user, cancellationToken);
        return Ok(response);
    }

    [HttpPost("refresh")]
    public async Task<ActionResult<AuthResponse>> Refresh(RefreshRequest request, CancellationToken cancellationToken)
    {
        var refreshTokenHash = _jwtTokenService.HashRefreshToken(request.RefreshToken);
        var refreshToken = await _dbContext.RefreshTokens
            .Include(token => token.User)
            .SingleOrDefaultAsync(token => token.TokenHash == refreshTokenHash, cancellationToken);

        if (refreshToken?.User is null || !refreshToken.IsActive(DateTime.UtcNow))
        {
            return Unauthorized();
        }

        refreshToken.RevokedAtUtc = DateTime.UtcNow;
        var response = await RotateRefreshTokenAsync(refreshToken.User, cancellationToken);
        return Ok(response);
    }

    private async Task<AuthResponse> RotateRefreshTokenAsync(AppUser user, CancellationToken cancellationToken)
    {
        var issuedToken = _jwtTokenService.IssueToken(user);
        _dbContext.RefreshTokens.Add(new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = _jwtTokenService.HashRefreshToken(issuedToken.RefreshToken),
            ExpiresAtUtc = DateTime.UtcNow.AddDays(_authOptions.RefreshTokenDays)
        });
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new AuthResponse(user.Id, user.Login, user.Email, issuedToken.AccessToken, issuedToken.RefreshToken, issuedToken.AccessTokenExpiresAtUtc);
    }
}
