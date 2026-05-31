namespace Ledgerra.Domain.ExchangeRates;

public sealed class UserExchangeRate
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public string FromCurrencyCode { get; set; } = "USD";

    public string ToCurrencyCode { get; set; } = "USD";

    public DateOnly Month { get; set; }

    public decimal Rate { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
