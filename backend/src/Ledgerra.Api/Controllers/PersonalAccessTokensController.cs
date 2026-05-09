using System.Security.Cryptography;
using System.Text;
using Ledgerra.Api.Contracts;
using Ledgerra.Api.Extensions;
using Ledgerra.Domain.Auth;
using Ledgerra.Infrastructure.Authentication;
using Ledgerra.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ledgerra.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/settings/personal-access-tokens")]
public sealed class PersonalAccessTokensController : ControllerBase
{
    private readonly LedgerraDbContext _dbContext;
    private readonly IJwtTokenService _jwtTokenService;

    public PersonalAccessTokensController(LedgerraDbContext dbContext, IJwtTokenService jwtTokenService)
    {
        _dbContext = dbContext;
        _jwtTokenService = jwtTokenService;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PersonalAccessTokenResponse>>> GetTokens(CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var tokens = await _dbContext.PersonalAccessTokens
            .Where(token => token.UserId == userId)
            .OrderByDescending(token => token.CreatedAtUtc)
            .Select(token => new PersonalAccessTokenResponse(token.Id, token.Name, token.TokenPrefix, token.CreatedAtUtc, token.LastUsedAtUtc, token.RevokedAtUtc))
            .ToListAsync(cancellationToken);

        return Ok(tokens);
    }

    [HttpPost]
    public async Task<ActionResult<CreatePersonalAccessTokenResponse>> CreateToken(CreatePersonalAccessTokenRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var user = await _dbContext.Users.SingleOrDefaultAsync(item => item.Id == userId, cancellationToken);
        if (user is null)
        {
            return NotFound();
        }

        var trimmedName = request.Name?.Trim();
        if (string.IsNullOrWhiteSpace(trimmedName))
        {
            ModelState.AddModelError(nameof(request.Name), "Token name cannot be empty or whitespace.");
            return BadRequest(ModelState);
        }

        var tokenId = Guid.NewGuid();
        var plainTextToken = _jwtTokenService.IssuePersonalAccessToken(user, tokenId);
        var tokenPrefixBytes = SHA256.HashData(Encoding.UTF8.GetBytes(plainTextToken));
        var tokenPrefix = Convert.ToHexString(tokenPrefixBytes)[..16];
        var token = new PersonalAccessToken
        {
            Id = tokenId,
            UserId = user.Id,
            Name = trimmedName,
            TokenHash = _jwtTokenService.HashRefreshToken(plainTextToken),
            TokenPrefix = tokenPrefix
        };

        _dbContext.PersonalAccessTokens.Add(token);
        await _dbContext.SaveChangesAsync(cancellationToken);

        var response = new PersonalAccessTokenResponse(token.Id, token.Name, token.TokenPrefix, token.CreatedAtUtc, token.LastUsedAtUtc, token.RevokedAtUtc);
        return StatusCode(StatusCodes.Status201Created, new CreatePersonalAccessTokenResponse(response, plainTextToken));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> RevokeToken(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var token = await _dbContext.PersonalAccessTokens.SingleOrDefaultAsync(item => item.Id == id && item.UserId == userId, cancellationToken);
        if (token is null)
        {
            return NotFound();
        }

        if (token.RevokedAtUtc == null)
        {
            token.RevokedAtUtc = DateTime.UtcNow;
        }
        await _dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}
