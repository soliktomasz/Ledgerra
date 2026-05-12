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
            ALTER TABLE "Users"
                ADD COLUMN IF NOT EXISTS "PreferredLanguageCode" character varying(10) NOT NULL DEFAULT 'en';

            ALTER TABLE "Transactions"
                ADD COLUMN IF NOT EXISTS "ParentTransactionId" uuid NULL;

            ALTER TABLE "Transactions"
                ADD COLUMN IF NOT EXISTS "SplitGroupId" uuid NULL;

            ALTER TABLE "Transactions"
                ADD COLUMN IF NOT EXISTS "TransferGroupId" uuid NULL;

            CREATE TABLE IF NOT EXISTS "SavingsGoals" (
                "Id" uuid NOT NULL,
                "UserId" uuid NOT NULL,
                "Name" character varying(120) NOT NULL,
                "TargetAmount" numeric(18,2) NOT NULL,
                "DeadlineUtc" timestamp with time zone NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NOT NULL,
                CONSTRAINT "PK_SavingsGoals" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_SavingsGoals_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
            );

            CREATE UNIQUE INDEX IF NOT EXISTS "IX_SavingsGoals_UserId_Name"
                ON "SavingsGoals" ("UserId", "Name");

            ALTER TABLE "Transactions"
                ADD COLUMN IF NOT EXISTS "SavingsGoalId" uuid NULL;

            CREATE INDEX IF NOT EXISTS "IX_Transactions_ParentTransactionId"
                ON "Transactions" ("ParentTransactionId");

            CREATE INDEX IF NOT EXISTS "IX_Transactions_SavingsGoalId"
                ON "Transactions" ("SavingsGoalId");

            CREATE INDEX IF NOT EXISTS "IX_Transactions_UserId_SplitGroupId"
                ON "Transactions" ("UserId", "SplitGroupId");

            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'FK_Transactions_Transactions_ParentTransactionId'
                      AND conrelid = '"Transactions"'::regclass
                ) THEN
                    ALTER TABLE "Transactions"
                        ADD CONSTRAINT "FK_Transactions_Transactions_ParentTransactionId"
                        FOREIGN KEY ("ParentTransactionId") REFERENCES "Transactions" ("Id") ON DELETE CASCADE;
                END IF;

                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'FK_Transactions_SavingsGoals_SavingsGoalId'
                      AND conrelid = '"Transactions"'::regclass
                ) THEN
                    ALTER TABLE "Transactions"
                        ADD CONSTRAINT "FK_Transactions_SavingsGoals_SavingsGoalId"
                        FOREIGN KEY ("SavingsGoalId") REFERENCES "SavingsGoals" ("Id") ON DELETE SET NULL;
                END IF;
            END $$;

            CREATE TABLE IF NOT EXISTS "AiProviderCredentials" (
                "Id" uuid NOT NULL,
                "UserId" uuid NOT NULL,
                "Provider" character varying(32) NOT NULL,
                "EncryptedApiKey" character varying(4096) NOT NULL,
                "MaskedKey" character varying(32) NOT NULL,
                "BaseUrl" character varying(2048) NULL,
                "Model" character varying(200) NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NOT NULL,
                CONSTRAINT "PK_AiProviderCredentials" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_AiProviderCredentials_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
            );

            ALTER TABLE "AiProviderCredentials"
                ADD COLUMN IF NOT EXISTS "BaseUrl" character varying(2048) NULL;

            ALTER TABLE "AiProviderCredentials"
                ADD COLUMN IF NOT EXISTS "Model" character varying(200) NULL;

            CREATE UNIQUE INDEX IF NOT EXISTS "IX_AiProviderCredentials_UserId_Provider"
                ON "AiProviderCredentials" ("UserId", "Provider");

            CREATE TABLE IF NOT EXISTS "PersonalAccessTokens" (
                "Id" uuid NOT NULL,
                "UserId" uuid NOT NULL,
                "Name" character varying(120) NOT NULL,
                "TokenHash" character varying(128) NOT NULL,
                "TokenPrefix" character varying(16) NOT NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "RevokedAtUtc" timestamp with time zone NULL,
                "LastUsedAtUtc" timestamp with time zone NULL,
                CONSTRAINT "PK_PersonalAccessTokens" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_PersonalAccessTokens_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
            );

            CREATE UNIQUE INDEX IF NOT EXISTS "IX_PersonalAccessTokens_TokenHash"
                ON "PersonalAccessTokens" ("TokenHash");

            CREATE INDEX IF NOT EXISTS "IX_PersonalAccessTokens_UserId_Name"
                ON "PersonalAccessTokens" ("UserId", "Name");

            CREATE TABLE IF NOT EXISTS "UserAiPreferences" (
                "UserId" uuid NOT NULL,
                "DefaultProvider" character varying(32) NULL,
                "UpdatedAtUtc" timestamp with time zone NOT NULL,
                CONSTRAINT "PK_UserAiPreferences" PRIMARY KEY ("UserId"),
                CONSTRAINT "FK_UserAiPreferences_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
            );

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

            CREATE TABLE IF NOT EXISTS "MonthlyAccountBalanceSnapshots" (
                "Id" uuid NOT NULL,
                "UserId" uuid NOT NULL,
                "AccountId" uuid NOT NULL,
                "MonthEndDate" date NOT NULL,
                "Balance" numeric(18,2) NOT NULL,
                "CurrencyCode" character varying(3) NOT NULL,
                CONSTRAINT "PK_MonthlyAccountBalanceSnapshots" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_MonthlyAccountBalanceSnapshots_Accounts_AccountId" FOREIGN KEY ("AccountId") REFERENCES "Accounts" ("Id") ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS "IX_MonthlyAccountBalanceSnapshots_AccountId"
                ON "MonthlyAccountBalanceSnapshots" ("AccountId");

            CREATE UNIQUE INDEX IF NOT EXISTS "IX_MonthlyAccountBalanceSnapshots_UserId_AccountId_MonthEndDate"
                ON "MonthlyAccountBalanceSnapshots" ("UserId", "AccountId", "MonthEndDate");
            """,
            cancellationToken);
    }
}
