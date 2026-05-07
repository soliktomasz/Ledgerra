using Ledgerra.Domain.Transactions;

namespace Ledgerra.Domain.Accounts;

public static class AccountBalanceCalculator
{
    public static decimal Calculate(Account account, IEnumerable<Transaction> transactions)
    {
        return account.OpeningBalance + transactions.Sum(GetSignedAmount);
    }

    private static decimal GetSignedAmount(Transaction transaction)
    {
        if (transaction.ParentTransactionId.HasValue)
        {
            return 0m;
        }

        return transaction.Type switch
        {
            TransactionType.Income => transaction.Amount,
            TransactionType.TransferIn => transaction.Amount,
            TransactionType.Expense => -transaction.Amount,
            TransactionType.TransferOut => -transaction.Amount,
            _ => 0m
        };
    }
}
