namespace Ledgerra.Domain.Ai;

public sealed class UserAiPreference
{
    public Guid UserId { get; set; }

    public AiProvider DefaultProvider { get; set; } = AiProvider.OpenAi;

    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
