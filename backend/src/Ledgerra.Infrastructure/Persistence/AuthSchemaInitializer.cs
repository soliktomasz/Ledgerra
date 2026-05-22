using Microsoft.EntityFrameworkCore;

namespace Ledgerra.Infrastructure.Persistence;

public static class AuthSchemaInitializer
{
    private const string NpgsqlProviderName = "Npgsql.EntityFrameworkCore.PostgreSQL";

    public const string MigrationSql =
        """
        ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "Login" character varying(32) NULL;

        WITH login_candidates AS (
            SELECT
                "Id",
                left(coalesce(nullif(lower(split_part("Email", '@', 1)), ''), 'user'), 24) AS base_login,
                row_number() OVER (
                    PARTITION BY left(coalesce(nullif(lower(split_part("Email", '@', 1)), ''), 'user'), 24)
                    ORDER BY "CreatedAtUtc", "Id"
                ) AS duplicate_number
            FROM "Users"
            WHERE "Login" IS NULL OR btrim("Login") = ''
        )
        UPDATE "Users"
        SET "Login" = CASE
            WHEN login_candidates.duplicate_number = 1 THEN left(login_candidates.base_login, 32)
            ELSE
                left(
                    login_candidates.base_login,
                    greatest(1, 32 - length(login_candidates.duplicate_number::text) - 1)
                ) || '-' || login_candidates.duplicate_number::text
            END
        FROM login_candidates
        WHERE "Users"."Id" = login_candidates."Id";

        ALTER TABLE "Users"
            ALTER COLUMN "Login" SET NOT NULL;

        DROP INDEX IF EXISTS "IX_Users_Nickname";

        CREATE UNIQUE INDEX IF NOT EXISTS "IX_Users_Login"
            ON "Users" ("Login");

        DROP INDEX IF EXISTS "IX_Users_Email";

        CREATE UNIQUE INDEX IF NOT EXISTS "IX_Users_Email"
            ON "Users" ("Email")
            WHERE "Email" <> '';
        """;

    public static async Task InitializeAsync(LedgerraDbContext dbContext, CancellationToken cancellationToken = default)
    {
        if (!dbContext.Database.IsRelational() ||
            dbContext.Database.ProviderName != NpgsqlProviderName)
        {
            return;
        }

        await dbContext.Database.ExecuteSqlRawAsync(MigrationSql, cancellationToken);
    }
}
