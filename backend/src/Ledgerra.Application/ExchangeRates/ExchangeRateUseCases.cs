using Ledgerra.Domain.ExchangeRates;

namespace Ledgerra.Application.ExchangeRates;

public sealed record ExchangeRateResult(Guid Id, string FromCurrencyCode, string ToCurrencyCode, string Month, decimal Rate, DateTime UpdatedAtUtc);

public sealed record UpsertExchangeRateCommand(Guid UserId, string FromCurrencyCode, string ToCurrencyCode, DateOnly Month, decimal Rate);

public interface IExchangeRateStore
{
    Task<IReadOnlyList<ExchangeRateResult>> GetForUserAsync(Guid userId, CancellationToken cancellationToken);

    Task<ExchangeRateResult> UpsertAsync(UpsertExchangeRateCommand command, CancellationToken cancellationToken);

    Task<bool> DeleteAsync(Guid userId, Guid rateId, CancellationToken cancellationToken);
}

public sealed class GetExchangeRatesQueryHandler
{
    private readonly IExchangeRateStore _store;

    public GetExchangeRatesQueryHandler(IExchangeRateStore store)
    {
        _store = store;
    }

    public Task<IReadOnlyList<ExchangeRateResult>> HandleAsync(Guid userId, CancellationToken cancellationToken)
    {
        return _store.GetForUserAsync(userId, cancellationToken);
    }
}

public sealed class UpsertExchangeRateCommandHandler
{
    private readonly IExchangeRateStore _store;

    public UpsertExchangeRateCommandHandler(IExchangeRateStore store)
    {
        _store = store;
    }

    public Task<ExchangeRateResult> HandleAsync(UpsertExchangeRateCommand command, CancellationToken cancellationToken)
    {
        var normalizedFrom = command.FromCurrencyCode.Trim().ToUpperInvariant();
        var normalizedTo = command.ToCurrencyCode.Trim().ToUpperInvariant();
        var normalizedMonth = new DateOnly(command.Month.Year, command.Month.Month, 1);

        if (command.Rate <= 0m)
        {
            throw new ArgumentException("Exchange rate must be positive.", nameof(command));
        }

        return _store.UpsertAsync(command with
        {
            FromCurrencyCode = normalizedFrom,
            ToCurrencyCode = normalizedTo,
            Month = normalizedMonth
        }, cancellationToken);
    }
}

public sealed class DeleteExchangeRateCommandHandler
{
    private readonly IExchangeRateStore _store;

    public DeleteExchangeRateCommandHandler(IExchangeRateStore store)
    {
        _store = store;
    }

    public Task<bool> HandleAsync(Guid userId, Guid rateId, CancellationToken cancellationToken)
    {
        return _store.DeleteAsync(userId, rateId, cancellationToken);
    }
}
