namespace Ledgerra.Domain.Ai;

public sealed class AiProviderCredential
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public AiProvider Provider { get; set; }

    public string EncryptedApiKey { get; set; } = string.Empty;

    public string MaskedKey { get; set; } = string.Empty;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
