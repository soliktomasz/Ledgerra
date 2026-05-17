using Microsoft.EntityFrameworkCore;

namespace Ledgerra.Infrastructure.Persistence;

public static class BudgetSchemaInitializer
{
    private const string NpgsqlProviderName = "Npgsql.EntityFrameworkCore.PostgreSQL";

    public static async Task InitializeAsync(LedgerraDbContext dbContext, CancellationToken cancellationToken = default)
    {
        if (!dbContext.Database.IsRelational() ||
            dbContext.Database.ProviderName != NpgsqlProviderName)
        {
            return;
        }

        await dbContext.Database.ExecuteSqlRawAsync(
            """
            ALTER TABLE "BudgetCategoryLimits"
                ADD COLUMN IF NOT EXISTS "CarryOverUnspent" boolean NOT NULL DEFAULT false;
            """,
            cancellationToken);
    }
}
