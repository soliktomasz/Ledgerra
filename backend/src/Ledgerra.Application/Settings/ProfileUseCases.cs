namespace Ledgerra.Application.Settings;

public sealed record GetProfileQuery(Guid UserId);

public sealed record UpdateProfileCommand(Guid UserId, string PreferredCurrencyCode, string PreferredLanguageCode);

public sealed record ProfileResult(string Email, string PreferredCurrencyCode, string PreferredLanguageCode);

public interface IUserProfileStore
{
    Task<ProfileResult?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken);

    Task<ProfileResult?> UpdatePreferencesAsync(Guid userId, string preferredCurrencyCode, string preferredLanguageCode, CancellationToken cancellationToken);
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
        var normalizedLanguageCode = NormalizeLanguageCode(command.PreferredLanguageCode);
        return _profileStore.UpdatePreferencesAsync(command.UserId, normalizedCurrencyCode, normalizedLanguageCode, cancellationToken);
    }

    private static string NormalizeLanguageCode(string value)
    {
        var normalized = value.Trim().Replace('_', '-');
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return "en";
        }

        var segments = normalized.Split('-', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (segments.Length == 0)
        {
            return "en";
        }

        return segments.Length == 1
            ? segments[0].ToLowerInvariant()
            : $"{segments[0].ToLowerInvariant()}-{segments[1].ToUpperInvariant()}";
    }
}