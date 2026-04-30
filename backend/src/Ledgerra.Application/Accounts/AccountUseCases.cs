using Ledgerra.Domain.Accounts;

namespace Ledgerra.Application.Accounts;

public sealed record GetAccountsQuery(Guid UserId);

public sealed record GetAccountByIdQuery(Guid UserId, Guid AccountId);

public sealed record CreateAccountCommand(Guid UserId, string Name, string Type, string CurrencyCode, decimal OpeningBalance);

public sealed record UpdateAccountCommand(
    Guid UserId,
    Guid AccountId,
    string Name,
    string Type,
    string CurrencyCode,
    decimal OpeningBalance,
    bool IsActive);

public sealed record DeleteAccountCommand(Guid UserId, Guid AccountId);

public sealed record AccountDetails(
    Guid Id,
    string Name,
    string Type,
    string CurrencyCode,
    decimal OpeningBalance,
    decimal CurrentBalance,
    bool IsActive);

public interface IAccountStore
{
    Task<IReadOnlyList<Account>> GetAllAsync(Guid userId, CancellationToken cancellationToken);

    Task<Account?> GetByIdAsync(Guid userId, Guid accountId, CancellationToken cancellationToken);

    Task<Account> CreateAsync(Account account, CancellationToken cancellationToken);

    Task<Account?> UpdateAsync(
        Guid userId,
        Guid accountId,
        string name,
        AccountType type,
        string currencyCode,
        decimal openingBalance,
        bool isActive,
        CancellationToken cancellationToken);

    Task<AccountDeleteStatus> DeleteAsync(Guid userId, Guid accountId, CancellationToken cancellationToken);
}

public enum AccountDeleteStatus
{
    Deleted,
    NotFound,
    HasTransactions
}

public sealed class GetAccountsQueryHandler
{
    private readonly IAccountStore _accountStore;

    public GetAccountsQueryHandler(IAccountStore accountStore)
    {
        _accountStore = accountStore;
    }

    public async Task<IReadOnlyList<AccountDetails>> HandleAsync(GetAccountsQuery query, CancellationToken cancellationToken)
    {
        var accounts = await _accountStore.GetAllAsync(query.UserId, cancellationToken);
        return accounts.Select(AccountMappings.MapAccount).ToList();
    }
}

public sealed class GetAccountByIdQueryHandler
{
    private readonly IAccountStore _accountStore;

    public GetAccountByIdQueryHandler(IAccountStore accountStore)
    {
        _accountStore = accountStore;
    }

    public async Task<AccountDetails?> HandleAsync(GetAccountByIdQuery query, CancellationToken cancellationToken)
    {
        var account = await _accountStore.GetByIdAsync(query.UserId, query.AccountId, cancellationToken);
        return account is null ? null : AccountMappings.MapAccount(account);
    }
}

public sealed class CreateAccountCommandHandler
{
    private readonly IAccountStore _accountStore;

    public CreateAccountCommandHandler(IAccountStore accountStore)
    {
        _accountStore = accountStore;
    }

    public async Task<AccountCommandResult> HandleAsync(CreateAccountCommand command, CancellationToken cancellationToken)
    {
        if (!Enum.TryParse<AccountType>(command.Type, true, out var accountType))
        {
            return AccountCommandResult.ValidationError("type", "Unsupported account type.");
        }

        var account = await _accountStore.CreateAsync(
            new Account
            {
                Id = Guid.NewGuid(),
                UserId = command.UserId,
                Name = command.Name.Trim(),
                Type = accountType,
                CurrencyCode = command.CurrencyCode.ToUpperInvariant(),
                OpeningBalance = command.OpeningBalance
            },
            cancellationToken);

        return AccountCommandResult.Success(AccountMappings.MapAccount(account));
    }
}

public sealed class UpdateAccountCommandHandler
{
    private readonly IAccountStore _accountStore;

    public UpdateAccountCommandHandler(IAccountStore accountStore)
    {
        _accountStore = accountStore;
    }

    public async Task<AccountCommandResult> HandleAsync(UpdateAccountCommand command, CancellationToken cancellationToken)
    {
        if (!Enum.TryParse<AccountType>(command.Type, true, out var accountType))
        {
            return AccountCommandResult.ValidationError("type", "Unsupported account type.");
        }

        var account = await _accountStore.UpdateAsync(
            command.UserId,
            command.AccountId,
            command.Name.Trim(),
            accountType,
            command.CurrencyCode.ToUpperInvariant(),
            command.OpeningBalance,
            command.IsActive,
            cancellationToken);

        return account is null
            ? AccountCommandResult.NotFound()
            : AccountCommandResult.Success(AccountMappings.MapAccount(account));
    }
}

public sealed class DeleteAccountCommandHandler
{
    private readonly IAccountStore _accountStore;

    public DeleteAccountCommandHandler(IAccountStore accountStore)
    {
        _accountStore = accountStore;
    }

    public Task<AccountDeleteStatus> HandleAsync(DeleteAccountCommand command, CancellationToken cancellationToken)
    {
        return _accountStore.DeleteAsync(command.UserId, command.AccountId, cancellationToken);
    }
}

public sealed class AccountCommandResult
{
    private AccountCommandResult(AccountDetails? account, string? validationKey, string? validationMessage, bool notFound)
    {
        Account = account;
        ValidationKey = validationKey;
        ValidationMessage = validationMessage;
        IsNotFound = notFound;
    }

    public AccountDetails? Account { get; }

    public string? ValidationKey { get; }

    public string? ValidationMessage { get; }

    public bool HasValidationError => ValidationKey is not null;

    public bool IsNotFound { get; }

    public static AccountCommandResult Success(AccountDetails account) => new(account, null, null, false);

    public static AccountCommandResult ValidationError(string key, string message) => new(null, key, message, false);

    public static AccountCommandResult NotFound() => new(null, null, null, true);
}

internal static class AccountMappings
{
    public static AccountDetails MapAccount(Account account)
    {
        return new AccountDetails(
            account.Id,
            account.Name,
            account.Type.ToString(),
            account.CurrencyCode,
            account.OpeningBalance,
            AccountBalanceCalculator.Calculate(account, account.Transactions),
            account.IsActive);
    }
}