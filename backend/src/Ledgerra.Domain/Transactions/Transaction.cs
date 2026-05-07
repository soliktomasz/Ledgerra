namespace Ledgerra.Domain.Transactions;

public sealed class Transaction
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public Guid AccountId { get; set; }

    public Guid? CategoryId { get; set; }

    public decimal Amount { get; set; }

    public TransactionType Type { get; set; }

    public string? Note { get; set; }

    public DateTime OccurredOnUtc { get; set; }

    public Guid? TransferGroupId { get; set; }

    public Guid? SavingsGoalId { get; set; }

    public Accounts.Account? Account { get; set; }

    public Categories.Category? Category { get; set; }
}
