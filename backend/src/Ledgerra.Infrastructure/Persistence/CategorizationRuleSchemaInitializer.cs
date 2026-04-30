using Microsoft.EntityFrameworkCore;

namespace Ledgerra.Infrastructure.Persistence;

public static class CategorizationRuleSchemaInitializer
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
            CREATE TABLE IF NOT EXISTS "CategorizationRules" (
                "Id" uuid NOT NULL,
                "UserId" uuid NOT NULL,
                "Name" character varying(120) NOT NULL,
                "MatchField" character varying(32) NOT NULL,
                "MatchOperator" character varying(32) NOT NULL,
                "MatchValue" character varying(200) NOT NULL,
                "AssignCategoryId" uuid NOT NULL,
                "AssignTransactionType" character varying(32) NOT NULL,
                "Priority" integer NOT NULL,
                "IsActive" boolean NOT NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NOT NULL,
                CONSTRAINT "PK_CategorizationRules" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_CategorizationRules_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE,
                CONSTRAINT "FK_CategorizationRules_Categories_AssignCategoryId" FOREIGN KEY ("AssignCategoryId") REFERENCES "Categories" ("Id") ON DELETE RESTRICT
            );

            CREATE INDEX IF NOT EXISTS "IX_CategorizationRules_AssignCategoryId"
                ON "CategorizationRules" ("AssignCategoryId");

            CREATE INDEX IF NOT EXISTS "IX_CategorizationRules_UserId_Priority"
                ON "CategorizationRules" ("UserId", "Priority");

            CREATE UNIQUE INDEX IF NOT EXISTS "IX_CategorizationRules_UserId_Name"
                ON "CategorizationRules" ("UserId", "Name");
            """,
            cancellationToken);
    }
}
