using Ledgerra.Api.Contracts;
using Ledgerra.Api.Extensions;
using Ledgerra.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ledgerra.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/settings")]
public sealed class SettingsController : ControllerBase
{
    private readonly LedgerraDbContext _dbContext;

    public SettingsController(LedgerraDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet("profile")]
    public async Task<ActionResult<ProfileResponse>> GetProfile(CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var user = await _dbContext.Users.SingleOrDefaultAsync(item => item.Id == userId, cancellationToken);

        return user is null
            ? NotFound()
            : Ok(new ProfileResponse(user.Email, user.PreferredCurrencyCode));
    }

    [HttpPut("profile")]
    public async Task<ActionResult<ProfileResponse>> UpdateProfile(UpdateProfileRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var user = await _dbContext.Users.SingleOrDefaultAsync(item => item.Id == userId, cancellationToken);
        if (user is null)
        {
            return NotFound();
        }

        user.PreferredCurrencyCode = request.PreferredCurrencyCode.Trim().ToUpperInvariant();
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new ProfileResponse(user.Email, user.PreferredCurrencyCode));
    }
}
