namespace Ledgerra.Domain.Accounts;

public sealed class Account
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public string Name { get; set; } = string.Empty;

    public AccountType Type { get; set; } = AccountType.Checking;

    public string CurrencyCode { get; set; } = "USD";

    public decimal OpeningBalance { get; set; }

    public bool IsActive { get; set; } = true;

    public string? InstitutionName { get; set; }

    public string? AccountNumberMasked { get; set; }

    public AccountIconKind IconKind { get; set; } = AccountIconKind.Bank;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public List<Transactions.Transaction> Transactions { get; set; } = [];
}
