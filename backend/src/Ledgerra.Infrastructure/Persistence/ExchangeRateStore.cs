using Ledgerra.Application.ExchangeRates;
using Ledgerra.Domain.ExchangeRates;
using Microsoft.EntityFrameworkCore;

namespace Ledgerra.Infrastructure.Persistence;

public sealed class ExchangeRateStore : IExchangeRateStore
{
    private readonly LedgerraDbContext _dbContext;

    public ExchangeRateStore(LedgerraDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<ExchangeRateResult>> GetForUserAsync(Guid userId, CancellationToken cancellationToken)
    {
        return await _dbContext.ExchangeRates
            .Where(rate => rate.UserId == userId)
            .OrderBy(rate => rate.FromCurrencyCode)
            .ThenByDescending(rate => rate.Month)
            .Select(rate => Map(rate))
            .ToListAsync(cancellationToken);
    }

    public async Task<ExchangeRateResult> UpsertAsync(UpsertExchangeRateCommand command, CancellationToken cancellationToken)
    {
        var existing = await _dbContext.ExchangeRates.SingleOrDefaultAsync(rate =>
            rate.UserId == command.UserId &&
            rate.FromCurrencyCode == command.FromCurrencyCode &&
            rate.ToCurrencyCode == command.ToCurrencyCode &&
            rate.Month == command.Month,
            cancellationToken);

        if (existing is null)
        {
            existing = new UserExchangeRate
            {
                Id = Guid.NewGuid(),
                UserId = command.UserId,
                FromCurrencyCode = command.FromCurrencyCode,
                ToCurrencyCode = command.ToCurrencyCode,
                Month = command.Month,
                CreatedAtUtc = DateTime.UtcNow
            };
            _dbContext.ExchangeRates.Add(existing);
        }

        existing.Rate = command.Rate;
        existing.UpdatedAtUtc = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Map(existing);
    }

    public async Task<bool> DeleteAsync(Guid userId, Guid rateId, CancellationToken cancellationToken)
    {
        var existing = await _dbContext.ExchangeRates.SingleOrDefaultAsync(rate => rate.UserId == userId && rate.Id == rateId, cancellationToken);
        if (existing is null)
        {
            return false;
        }

        _dbContext.ExchangeRates.Remove(existing);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static ExchangeRateResult Map(UserExchangeRate rate)
    {
        return new ExchangeRateResult(
            rate.Id,
            rate.FromCurrencyCode,
            rate.ToCurrencyCode,
            $"{rate.Month.Year:D4}-{rate.Month.Month:D2}",
            rate.Rate,
            rate.UpdatedAtUtc);
    }
}
