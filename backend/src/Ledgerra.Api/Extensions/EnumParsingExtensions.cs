using Ledgerra.Domain.Accounts;
using Ledgerra.Domain.Categories;
using Ledgerra.Domain.Transactions;

namespace Ledgerra.Api.Extensions;

public static class EnumParsingExtensions
{
    public static bool TryParseAccountType(string value, out AccountType type)
    {
        return Enum.TryParse(value, true, out type);
    }

    public static bool TryParseCategoryKind(string value, out CategoryKind kind)
    {
        return Enum.TryParse(value, true, out kind);
    }

    public static bool TryParseTransactionType(string value, out TransactionType type)
    {
        return Enum.TryParse(value, true, out type);
    }
}
