using Ledgerra.Domain.Accounts;
using Ledgerra.Domain.Budgets;
using Ledgerra.Domain.Categories;
using Ledgerra.Domain.Transactions;

namespace Ledgerra.Domain.Auth;

public sealed class AppUser
{
    public Guid Id { get; set; }

    public string Email { get; set; } = string.Empty;

    public string PasswordHash { get; set; } = string.Empty;

    public string PreferredCurrencyCode { get; set; } = "USD";

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public List<Account> Accounts { get; set; } = [];

    public List<Category> Categories { get; set; } = [];

    public List<Transaction> Transactions { get; set; } = [];

    public List<BudgetPeriod> BudgetPeriods { get; set; } = [];

    public List<RefreshToken> RefreshTokens { get; set; } = [];
}
