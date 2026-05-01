using Ledgerra.Application.Settings;
using Microsoft.EntityFrameworkCore;

namespace Ledgerra.Infrastructure.Persistence;

public sealed class UserProfileStore : IUserProfileStore
{
    private readonly LedgerraDbContext _dbContext;

    public UserProfileStore(LedgerraDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<ProfileResult?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken)
    {
        return await _dbContext.Users
            .Where(item => item.Id == userId)
            .Select(item => new ProfileResult(item.Email, item.PreferredCurrencyCode, item.PreferredLanguageCode))
            .SingleOrDefaultAsync(cancellationToken);
    }

    public async Task<ProfileResult?> UpdatePreferencesAsync(Guid userId, string preferredCurrencyCode, string preferredLanguageCode, CancellationToken cancellationToken)
    {
        var user = await _dbContext.Users.SingleOrDefaultAsync(item => item.Id == userId, cancellationToken);
        if (user is null)
        {
            return null;
        }

        user.PreferredCurrencyCode = preferredCurrencyCode;
        user.PreferredLanguageCode = preferredLanguageCode;
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new ProfileResult(user.Email, user.PreferredCurrencyCode, user.PreferredLanguageCode);
    }
}