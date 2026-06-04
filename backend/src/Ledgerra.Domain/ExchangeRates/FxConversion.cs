namespace Ledgerra.Domain.ExchangeRates;

public sealed record FxConversionWarning(string Code, string Message);

public sealed record FxConversionResult(decimal Amount, IReadOnlyList<FxConversionWarning> Warnings);

public sealed record FxConversionRate(string FromCurrencyCode, string ToCurrencyCode, DateOnly Month, decimal Rate);

public static class FxRateConverter
{
    public static FxConversionResult Convert(
        decimal amount,
        string fromCurrencyCode,
        string toCurrencyCode,
        DateOnly month,
        IEnumerable<FxConversionRate> rates)
    {
        var normalizedFrom = NormalizeCurrency(fromCurrencyCode);
        var normalizedTo = NormalizeCurrency(toCurrencyCode);

        if (string.Equals(normalizedFrom, normalizedTo, StringComparison.OrdinalIgnoreCase))
        {
            return new FxConversionResult(amount, []);
        }

        var monthStart = new DateOnly(month.Year, month.Month, 1);
        var candidate = rates
            .Where(rate =>
                string.Equals(rate.FromCurrencyCode, normalizedFrom, StringComparison.OrdinalIgnoreCase) &&
                string.Equals(rate.ToCurrencyCode, normalizedTo, StringComparison.OrdinalIgnoreCase) &&
                rate.Month <= monthStart)
            .OrderByDescending(rate => rate.Month)
            .FirstOrDefault();

        if (candidate is null)
        {
            return new FxConversionResult(0m,
            [
                new FxConversionWarning(
                    "MissingFxRate",
                    $"Missing FX rate for {normalizedFrom} to {normalizedTo} in {monthStart:yyyy-MM}.")
            ]);
        }

        var converted = Math.Round(amount * candidate.Rate, 2, MidpointRounding.AwayFromZero);
        if (candidate.Month == monthStart)
        {
            return new FxConversionResult(converted, []);
        }

        return new FxConversionResult(converted,
        [
            new FxConversionWarning(
                "StaleFxRate",
                $"Using {candidate.Month:yyyy-MM} FX rate for {normalizedFrom} to {normalizedTo} in {monthStart:yyyy-MM}.")
        ]);
    }

    private static string NormalizeCurrency(string currencyCode)
    {
        return string.IsNullOrWhiteSpace(currencyCode) ? "USD" : currencyCode.Trim().ToUpperInvariant();
    }
}
