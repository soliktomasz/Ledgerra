using System.Data;
using Ledgerra.Application.Transactions;
using Ledgerra.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Ledgerra.Api.Services;

public interface IRecurringTransactionGenerationLease : IAsyncDisposable
{
    Task<bool> IsHeldAsync(CancellationToken cancellationToken);
}

public interface IRecurringTransactionGenerationCoordinator
{
    Task<IRecurringTransactionGenerationLease?> TryAcquireAsync(CancellationToken cancellationToken);
}

public sealed class RecurringTransactionGenerationService : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromHours(1);
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IRecurringTransactionGenerationCoordinator _coordinator;
    private readonly ILogger<RecurringTransactionGenerationService> _logger;

    public RecurringTransactionGenerationService(IServiceScopeFactory scopeFactory, IRecurringTransactionGenerationCoordinator coordinator, ILogger<RecurringTransactionGenerationService> logger)
    {
        _scopeFactory = scopeFactory;
        _coordinator = coordinator;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            await using var lease = await _coordinator.TryAcquireAsync(stoppingToken);
            if (lease is null)
            {
                _logger.LogInformation("Recurring transaction generation is already running on another instance.");
                await Task.Delay(Interval, stoppingToken);
                continue;
            }

            await RunGenerationLoopAsync(lease, stoppingToken);
        }
    }

    private async Task RunGenerationLoopAsync(IRecurringTransactionGenerationLease lease, CancellationToken stoppingToken)
    {
        if (await lease.IsHeldAsync(stoppingToken))
        {
            await GenerateOnceAsync(stoppingToken);
        }

        using var timer = new PeriodicTimer(Interval);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            if (!await lease.IsHeldAsync(stoppingToken))
            {
                _logger.LogWarning("Recurring transaction generation lease was lost.");
                break;
            }

            await GenerateOnceAsync(stoppingToken);
        }
    }

    private async Task GenerateOnceAsync(CancellationToken stoppingToken)
    {
        try
        {
            await using var scope = _scopeFactory.CreateAsyncScope();
            var useCases = scope.ServiceProvider.GetRequiredService<RecurringTransactionUseCases>();
            var generated = await useCases.GenerateDueForUsersBatchAsync(DateTime.UtcNow, 50, stoppingToken);
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

public sealed class PostgresRecurringTransactionGenerationCoordinator : IRecurringTransactionGenerationCoordinator
{
    private const long LockId = 0x4c65646765727261;
    private readonly IServiceScopeFactory _scopeFactory;

    public PostgresRecurringTransactionGenerationCoordinator(IServiceScopeFactory scopeFactory)
    {
        _scopeFactory = scopeFactory;
    }

    public async Task<IRecurringTransactionGenerationLease?> TryAcquireAsync(CancellationToken cancellationToken)
    {
        var scope = _scopeFactory.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<LedgerraDbContext>();
        if (!dbContext.Database.IsNpgsql())
        {
            return new LocalRecurringTransactionGenerationLease(scope);
        }

        await dbContext.Database.OpenConnectionAsync(cancellationToken);
        var acquired = await ExecuteScalarAsync<bool>(dbContext, "SELECT pg_try_advisory_lock(@lockId)", cancellationToken);
        if (!acquired)
        {
            await scope.DisposeAsync();
            return null;
        }

        return new PostgresRecurringTransactionGenerationLease(scope, dbContext);
    }

    private static async Task<T> ExecuteScalarAsync<T>(LedgerraDbContext dbContext, string commandText, CancellationToken cancellationToken = default)
    {
        var connection = dbContext.Database.GetDbConnection();
        await using var command = connection.CreateCommand();
        command.CommandText = commandText;
        if (commandText.Contains("@lockId", StringComparison.Ordinal))
        {
            var parameter = command.CreateParameter();
            parameter.ParameterName = "lockId";
            parameter.Value = LockId;
            command.Parameters.Add(parameter);
        }

        var result = await command.ExecuteScalarAsync(cancellationToken);
        if (result is null || result is DBNull)
        {
            throw new InvalidOperationException("Recurring transaction generation lock query returned no value.");
        }

        return result is T typed ? typed : (T)Convert.ChangeType(result, typeof(T));
    }

    private sealed class PostgresRecurringTransactionGenerationLease : IRecurringTransactionGenerationLease
    {
        private readonly AsyncServiceScope _scope;
        private readonly LedgerraDbContext _dbContext;

        public PostgresRecurringTransactionGenerationLease(AsyncServiceScope scope, LedgerraDbContext dbContext)
        {
            _scope = scope;
            _dbContext = dbContext;
        }

        public async Task<bool> IsHeldAsync(CancellationToken cancellationToken)
        {
            if (_dbContext.Database.GetDbConnection().State != ConnectionState.Open)
            {
                return false;
            }

            _ = await ExecuteScalarAsync<int>(_dbContext, "SELECT 1", cancellationToken);
            return true;
        }

        public async ValueTask DisposeAsync()
        {
            if (_dbContext.Database.GetDbConnection().State == ConnectionState.Open)
            {
                await ExecuteScalarAsync<bool>(_dbContext, "SELECT pg_advisory_unlock(@lockId)");
            }

            await _scope.DisposeAsync();
        }
    }

    private sealed class LocalRecurringTransactionGenerationLease : IRecurringTransactionGenerationLease
    {
        private readonly AsyncServiceScope _scope;

        public LocalRecurringTransactionGenerationLease(AsyncServiceScope scope)
        {
            _scope = scope;
        }

        public Task<bool> IsHeldAsync(CancellationToken cancellationToken)
            => Task.FromResult(true);

        public async ValueTask DisposeAsync()
            => await _scope.DisposeAsync();
    }
}
