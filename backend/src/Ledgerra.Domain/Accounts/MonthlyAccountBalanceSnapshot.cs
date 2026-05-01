namespace Ledgerra.Domain.Accounts;

public sealed class MonthlyAccountBalanceSnapshot
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public Guid AccountId { get; set; }

    public DateOnly MonthEndDate { get; set; }

    public decimal Balance { get; set; }

    public string CurrencyCode { get; set; } = "USD";

    public Account? Account { get; set; }
}
