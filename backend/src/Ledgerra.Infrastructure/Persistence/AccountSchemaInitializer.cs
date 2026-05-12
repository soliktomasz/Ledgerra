using Microsoft.EntityFrameworkCore;

namespace Ledgerra.Infrastructure.Persistence;

public static class AccountSchemaInitializer
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
            ALTER TABLE "Accounts" ADD COLUMN IF NOT EXISTS "InstitutionName" character varying(120) NULL;
            ALTER TABLE "Accounts" ADD COLUMN IF NOT EXISTS "AccountNumberMasked" character varying(64) NULL;
            ALTER TABLE "Accounts" ADD COLUMN IF NOT EXISTS "IconKind" integer NOT NULL DEFAULT 1;
            """,
            cancellationToken);
    }
}
