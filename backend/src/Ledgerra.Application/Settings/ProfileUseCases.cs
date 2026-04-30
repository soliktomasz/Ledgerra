namespace Ledgerra.Application.Settings;

public sealed record GetProfileQuery(Guid UserId);

public sealed record UpdateProfileCommand(Guid UserId, string PreferredCurrencyCode);

public sealed record ProfileResult(string Email, string PreferredCurrencyCode);

public interface IUserProfileStore
{
    Task<ProfileResult?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken);

    Task<ProfileResult?> UpdatePreferredCurrencyAsync(Guid userId, string preferredCurrencyCode, CancellationToken cancellationToken);
}

public sealed class GetProfileQueryHandler
{
    private readonly IUserProfileStore _profileStore;

    public GetProfileQueryHandler(IUserProfileStore profileStore)
    {
        _profileStore = profileStore;
    }

    public Task<ProfileResult?> HandleAsync(GetProfileQuery query, CancellationToken cancellationToken)
    {
        return _profileStore.GetByUserIdAsync(query.UserId, cancellationToken);
    }
}

public sealed class UpdateProfileCommandHandler
{
    private readonly IUserProfileStore _profileStore;

    public UpdateProfileCommandHandler(IUserProfileStore profileStore)
    {
        _profileStore = profileStore;
    }

    public Task<ProfileResult?> HandleAsync(UpdateProfileCommand command, CancellationToken cancellationToken)
    {
        var normalizedCurrencyCode = command.PreferredCurrencyCode.Trim().ToUpperInvariant();
        return _profileStore.UpdatePreferredCurrencyAsync(command.UserId, normalizedCurrencyCode, cancellationToken);
    }
}