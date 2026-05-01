using Ledgerra.Api.Contracts;
using Ledgerra.Api.Extensions;
using Ledgerra.Application.Settings;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ledgerra.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/settings")]
public sealed class SettingsController : ControllerBase
{
    private readonly GetProfileQueryHandler _getProfileQueryHandler;
    private readonly UpdateProfileCommandHandler _updateProfileCommandHandler;

    public SettingsController(GetProfileQueryHandler getProfileQueryHandler, UpdateProfileCommandHandler updateProfileCommandHandler)
    {
        _getProfileQueryHandler = getProfileQueryHandler;
        _updateProfileCommandHandler = updateProfileCommandHandler;
    }

    [HttpGet("profile")]
    public async Task<ActionResult<ProfileResponse>> GetProfile(CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var profile = await _getProfileQueryHandler.HandleAsync(new GetProfileQuery(userId), cancellationToken);

        return profile is null
            ? NotFound()
            : Ok(new ProfileResponse(profile.Email, profile.PreferredCurrencyCode));
    }

    [HttpPut("profile")]
    public async Task<ActionResult<ProfileResponse>> UpdateProfile(UpdateProfileRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var profile = await _updateProfileCommandHandler.HandleAsync(
            new UpdateProfileCommand(userId, request.PreferredCurrencyCode),
            cancellationToken);

        if (profile is null)
        {
            return NotFound();
        }

        return Ok(new ProfileResponse(profile.Email, profile.PreferredCurrencyCode));
    }
}
