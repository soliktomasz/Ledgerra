using Ledgerra.Domain.Accounts;
using Ledgerra.Application.Reporting;

namespace Ledgerra.Application.Accounts;

public sealed record GetAccountsQuery(Guid UserId);

public sealed record GetAccountByIdQuery(Guid UserId, Guid AccountId);

public sealed record CreateAccountCommand(
    Guid UserId,
    string Name,
    string Type,
    string CurrencyCode,
    decimal OpeningBalance,
    string? InstitutionName,
    string? AccountNumberMasked,
    string? IconKind);

public sealed record UpdateAccountCommand(
    Guid UserId,
    Guid AccountId,
    string Name,
    string Type,
    string CurrencyCode,
    decimal OpeningBalance,
    bool IsActive,
    string? InstitutionName,
    string? AccountNumberMasked,
    string? IconKind);

public sealed record DeleteAccountCommand(Guid UserId, Guid AccountId);

public sealed record AccountDetails(
    Guid Id,
    string Name,
    string Type,
    string CurrencyCode,
    decimal OpeningBalance,
    decimal CurrentBalance,
    bool IsActive,
    string? InstitutionName,
    string? AccountNumberMasked,
    string IconKind);

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
        string? institutionName,
        string? accountNumberMasked,
        AccountIconKind? iconKind,
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
    private readonly IMonthlyAccountBalanceSnapshotService? _snapshotService;

    public CreateAccountCommandHandler(IAccountStore accountStore, IMonthlyAccountBalanceSnapshotService? snapshotService = null)
    {
        _accountStore = accountStore;
        _snapshotService = snapshotService;
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
                OpeningBalance = command.OpeningBalance,
                InstitutionName = command.InstitutionName,
                AccountNumberMasked = command.AccountNumberMasked,
                IconKind = Enum.TryParse<AccountIconKind>(command.IconKind, ignoreCase: true, out var iconKind) ? iconKind : AccountIconKind.Bank
            },
            cancellationToken);

        if (_snapshotService is not null)
        {
            var currentMonth = new DateOnly(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1);
            await _snapshotService.RefreshFromAsync(command.UserId, currentMonth, account.Id, cancellationToken);
        }

        return AccountCommandResult.Success(AccountMappings.MapAccount(account));
    }
}

public sealed class UpdateAccountCommandHandler
{
    private readonly IAccountStore _accountStore;
    private readonly IMonthlyAccountBalanceSnapshotService? _snapshotService;

    public UpdateAccountCommandHandler(IAccountStore accountStore, IMonthlyAccountBalanceSnapshotService? snapshotService = null)
    {
        _accountStore = accountStore;
        _snapshotService = snapshotService;
    }

    public async Task<AccountCommandResult> HandleAsync(UpdateAccountCommand command, CancellationToken cancellationToken)
    {
        if (!Enum.TryParse<AccountType>(command.Type, true, out var accountType))
        {
            return AccountCommandResult.ValidationError("type", "Unsupported account type.");
        }

        AccountIconKind? iconKindToPersist = string.IsNullOrWhiteSpace(command.IconKind)
            ? null
            : (Enum.TryParse<AccountIconKind>(command.IconKind, ignoreCase: true, out var parsedIconKind)
                ? parsedIconKind
                : (AccountIconKind?)null);

        var account = await _accountStore.UpdateAsync(
            command.UserId,
            command.AccountId,
            command.Name.Trim(),
            accountType,
            command.CurrencyCode.ToUpperInvariant(),
            command.OpeningBalance,
            command.IsActive,
            command.InstitutionName,
            command.AccountNumberMasked,
            iconKindToPersist,
            cancellationToken);

        if (account is null)
        {
            return AccountCommandResult.NotFound();
        }

        if (_snapshotService is not null)
        {
            var accountStartMonth = new DateOnly(account.CreatedAtUtc.Year, account.CreatedAtUtc.Month, 1);
            await _snapshotService.RefreshFromAsync(command.UserId, accountStartMonth, account.Id, cancellationToken);
        }

        return AccountCommandResult.Success(AccountMappings.MapAccount(account));
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
            account.IsActive,
            account.InstitutionName,
            account.AccountNumberMasked,
            account.IconKind.ToString());
    }
}
