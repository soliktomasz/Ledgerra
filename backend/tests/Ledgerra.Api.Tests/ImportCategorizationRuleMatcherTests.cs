using Ledgerra.Api.Services.Imports;
using Ledgerra.Domain.Imports;
using Ledgerra.Domain.Transactions;
using Ledgerra.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Ledgerra.Api.Tests;

public sealed class ImportCategorizationRuleMatcherTests
{
    [Fact]
    public async Task ApplyAsync_UsesPriorityAndSkipsInactiveRules()
    {
        var userId = Guid.NewGuid();
        var categoryId = Guid.NewGuid();
        await using var db = CreateDb();
        db.CategorizationRules.AddRange(
            Rule(userId, "inactive", 1, false, ImportRuleMatchField.Note, ImportRuleMatchOperator.Contains, "coffee", categoryId),
            Rule(userId, "winner", 2, true, ImportRuleMatchField.Note, ImportRuleMatchOperator.Contains, "coffee", categoryId),
            Rule(userId, "later", 3, true, ImportRuleMatchField.Note, ImportRuleMatchOperator.Contains, "coffee", Guid.NewGuid()));
        await db.SaveChangesAsync();

        var matcher = new ImportCategorizationRuleMatcher(db);
        var draft = Draft(note: "Morning coffee", amount: 8, type: "Expense");

        var result = await matcher.ApplyAsync(userId, [draft], CancellationToken.None);

        Assert.Equal("winner", result[0].AppliedRuleName);
        Assert.Equal(categoryId, result[0].CategoryId);
    }

    [Theory]
    [InlineData(ImportRuleMatchField.Amount, ImportRuleMatchOperator.Between, "10..20", 15, true)]
    [InlineData(ImportRuleMatchField.Amount, ImportRuleMatchOperator.GreaterThan, "10", 7, false)]
    [InlineData(ImportRuleMatchField.Type, ImportRuleMatchOperator.Equals, "Income", 0, true)]
    [InlineData(ImportRuleMatchField.Month, ImportRuleMatchOperator.Equals, "5", 0, true)]
    public async Task ApplyAsync_MatchesExtendedOperators(ImportRuleMatchField field, ImportRuleMatchOperator op, string value, decimal amount, bool expected)
    {
        var userId = Guid.NewGuid();
        await using var db = CreateDb();
        db.CategorizationRules.Add(Rule(userId, "rule", 1, true, field, op, value, Guid.NewGuid()));
        await db.SaveChangesAsync();

        var matcher = new ImportCategorizationRuleMatcher(db);
        var draft = Draft(note: "hello", amount: amount == 0 ? 11 : amount, type: "Income", date: new DateTime(2026, 5, 12, 0, 0, 0, DateTimeKind.Utc));

        var result = await matcher.ApplyAsync(userId, [draft], CancellationToken.None);
        Assert.Equal(expected, result[0].AppliedRuleName is not null);
    }

    private static LedgerraDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<LedgerraDbContext>()
            .UseInMemoryDatabase($"ledgerra-import-rules-{Guid.NewGuid():N}")
            .Options;
        return new LedgerraDbContext(options);
    }

    private static CategorizationRule Rule(Guid userId, string name, int priority, bool active, ImportRuleMatchField field, ImportRuleMatchOperator op, string value, Guid categoryId)
    {
        return new CategorizationRule
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Name = name,
            MatchField = field,
            MatchOperator = op,
            MatchValue = value,
            AssignCategoryId = categoryId,
            AssignTransactionType = TransactionType.Expense,
            Priority = priority,
            IsActive = active
        };
    }

    private static ImportDraftReviewItem Draft(string note, decimal amount, string type, DateTime? date = null)
    {
        return new ImportDraftReviewItem("src", Guid.NewGuid(), null, amount, type, date ?? DateTime.UtcNow, note, 0.9m, [], null, null, false, null, null, true);
    }
}
