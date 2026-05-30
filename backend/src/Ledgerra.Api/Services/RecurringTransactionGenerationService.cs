using Ledgerra.Application.Transactions;

namespace Ledgerra.Api.Services;

public sealed class RecurringTransactionGenerationService : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromHours(1);
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<RecurringTransactionGenerationService> _logger;

    public RecurringTransactionGenerationService(IServiceScopeFactory scopeFactory, ILogger<RecurringTransactionGenerationService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await GenerateOnceAsync(stoppingToken);

        using var timer = new PeriodicTimer(Interval);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            await GenerateOnceAsync(stoppingToken);
        }
    }

    private async Task GenerateOnceAsync(CancellationToken stoppingToken)
    {
        try
        {
            await using var scope = _scopeFactory.CreateAsyncScope();
            var useCases = scope.ServiceProvider.GetRequiredService<RecurringTransactionUseCases>();
            var generated = await useCases.GenerateDueForAllUsersAsync(DateTime.UtcNow, stoppingToken);
            if (generated > 0)
            {
                _logger.LogInformation("Generated {Count} due recurring transactions.", generated);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
        }
        catch (Exception exception)
        {
            _logger.LogWarning(exception, "Unable to generate due recurring transactions.");
        }
    }
}
