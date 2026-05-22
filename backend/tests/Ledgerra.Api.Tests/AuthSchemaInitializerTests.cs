using Ledgerra.Domain.Auth;
using Ledgerra.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Ledgerra.Api.Tests;

public sealed class AuthSchemaInitializerTests
{
    [Fact]
    public void MigrationSql_BackfillsLoginColumnForExistingPostgresDatabases()
    {
        var sql = AuthSchemaInitializer.MigrationSql;

        Assert.Contains("ALTER TABLE \"Users\" ADD COLUMN IF NOT EXISTS \"Login\"", sql);
        Assert.Contains("UPDATE \"Users\"", sql);
        Assert.Contains("ALTER COLUMN \"Login\" SET NOT NULL", sql);
        Assert.Contains("DROP INDEX IF EXISTS \"IX_Users_Nickname\"", sql);
        Assert.Contains("CREATE UNIQUE INDEX IF NOT EXISTS \"IX_Users_Login\"", sql);
        Assert.Contains("DROP INDEX IF EXISTS \"IX_Users_Email\"", sql);
        Assert.Contains("WHERE \"Email\" <> ''", sql);
    }

    [Fact]
    public void Model_UsesPartialUniqueEmailIndex()
    {
        var options = new DbContextOptionsBuilder<LedgerraDbContext>()
            .UseInMemoryDatabase($"ledgerra-model-{Guid.NewGuid():N}")
            .Options;

        using var dbContext = new LedgerraDbContext(options);
        var emailIndex = dbContext.Model
            .FindEntityType(typeof(AppUser))!
            .GetIndexes()
            .Single(index => index.Properties.Any(property => property.Name == nameof(AppUser.Email)));

        Assert.True(emailIndex.IsUnique);
        Assert.Equal("\"Email\" <> ''", emailIndex.GetFilter());
    }
}
