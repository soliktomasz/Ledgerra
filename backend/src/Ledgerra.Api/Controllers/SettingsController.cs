using Ledgerra.Api.Contracts;
using Ledgerra.Api.Extensions;
using Ledgerra.Application.Settings;
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
    private readonly GetProfileQueryHandler _getProfileQueryHandler;
    private readonly UpdateProfileCommandHandler _updateProfileCommandHandler;

    public SettingsController(
        LedgerraDbContext dbContext,
        GetProfileQueryHandler getProfileQueryHandler,
        UpdateProfileCommandHandler updateProfileCommandHandler)
    {
        _dbContext = dbContext;
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
            : Ok(new ProfileResponse(profile.Email, profile.PreferredCurrencyCode, profile.PreferredLanguageCode));
    }

    [HttpPut("profile")]
    public async Task<ActionResult<ProfileResponse>> UpdateProfile(UpdateProfileRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var profile = await _updateProfileCommandHandler.HandleAsync(
            new UpdateProfileCommand(userId, request.PreferredCurrencyCode, request.PreferredLanguageCode),
            cancellationToken);

        if (profile is null)
        {
            return NotFound();
        }

        return Ok(new ProfileResponse(profile.Email, profile.PreferredCurrencyCode, profile.PreferredLanguageCode));
    }

    [HttpDelete("account-data")]
    public async Task<ActionResult> ClearAccountData(CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        if (!await _dbContext.Users.AnyAsync(user => user.Id == userId, cancellationToken))
        {
            return NotFound();
        }

        ClearAccountData(userId);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    [HttpDelete("account")]
    public async Task<ActionResult> DeleteAccount(CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var user = await _dbContext.Users.SingleOrDefaultAsync(item => item.Id == userId, cancellationToken);
        if (user is null)
        {
            return NotFound();
        }

        await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);

        ClearAccountData(userId);

        _dbContext.PersonalAccessTokens.RemoveRange(_dbContext.PersonalAccessTokens.Where(token => token.UserId == userId));
        _dbContext.RefreshTokens.RemoveRange(_dbContext.RefreshTokens.Where(token => token.UserId == userId));
        _dbContext.Users.Remove(user);
        await _dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return NoContent();
    }

    private void ClearAccountData(Guid userId)
    {
        var budgetPeriodIds = _dbContext.BudgetPeriods.Where(period => period.UserId == userId).Select(period => period.Id);

        _dbContext.BudgetCategoryLimits.RemoveRange(_dbContext.BudgetCategoryLimits.Where(limit => budgetPeriodIds.Contains(limit.BudgetPeriodId)));
        _dbContext.BudgetPeriods.RemoveRange(_dbContext.BudgetPeriods.Where(period => period.UserId == userId));
        _dbContext.RecurringTransactionTemplates.RemoveRange(_dbContext.RecurringTransactionTemplates.Where(template => template.UserId == userId));
        _dbContext.MonthlyAccountBalanceSnapshots.RemoveRange(_dbContext.MonthlyAccountBalanceSnapshots.Where(snapshot => snapshot.UserId == userId));
        _dbContext.Transactions.RemoveRange(_dbContext.Transactions.Where(transaction => transaction.UserId == userId));
        _dbContext.CategorizationRules.RemoveRange(_dbContext.CategorizationRules.Where(rule => rule.UserId == userId));
        _dbContext.SavingsGoals.RemoveRange(_dbContext.SavingsGoals.Where(goal => goal.UserId == userId));
        _dbContext.Categories.RemoveRange(_dbContext.Categories.Where(category => category.UserId == userId));
        _dbContext.Accounts.RemoveRange(_dbContext.Accounts.Where(account => account.UserId == userId));
        _dbContext.AiProviderCredentials.RemoveRange(_dbContext.AiProviderCredentials.Where(credential => credential.UserId == userId));
        _dbContext.UserAiPreferences.RemoveRange(_dbContext.UserAiPreferences.Where(preference => preference.UserId == userId));
    }
}
